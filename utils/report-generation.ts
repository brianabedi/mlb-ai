// app/utils/report-generation.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { JWT } from 'google-auth-library';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js'
import { User, Report } from '@/types/user';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const emailConfig = {
  host: 'smtp.porkbun.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: true
  }
};

// Types
interface User {
  id: string;
  email: string | undefined;
}

interface Report {
  title: string;
  content: string;
  image_url?: string | null;
}

interface ReportContent {
  reportText: string;
  imagePrompt: string;
}

interface Follows {
  teamFollows: Array<{ team_id: string }>;
  playerFollows: Array<{ player_id: string }>;
}

let predictionClient: { predict: any; };

async function getGoogleCredentials() {  // New function to fetch credentials
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase.storage
      .from('secret') // Your private bucket name
      .createSignedUrl('mlb-ai-449901-72e2e38c7372.json', 60 * 60 * 24); // 24-hour expiry

    if (error) {
      throw new Error(`Error generating signed URL: ${error.message}`);
    }

    const response = await fetch(data.signedUrl);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to fetch credentials: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const credentials = await response.json();
    return credentials;

  } catch (error) {
    console.error("Error fetching Google Credentials:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

try {
  // const credStr = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  // if (!credStr) {
  //   throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  // }

  // const credentials = JSON.parse(fs.readFileSync(credStr, 'utf8')); // Correct way to read the file
  const credentials = await getGoogleCredentials();

  // Create wrapper for predictions
  predictionClient = {
    async predict(request) {
      try {
        // Create JWT client
        const client = new JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        // Get access token
        const token = await client.authorize();
        console.log('Successfully obtained access token');
        
        const response = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/${request.endpoint}:predict`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instances: request.instances,
              parameters: request.parameters
            }),
          }
        );

        // console.log('API Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          // console.log("Full API Response (Successful):", JSON.stringify(data, null, 2)); // Log successful response
          return [data];
        } else {
          try {  // Attempt to parse error JSON
            const errorData = await response.json();
            // console.error("API Error Response:", response.status, JSON.stringify(errorData, null, 2));
            throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || JSON.stringify(errorData) || response.statusText}`);
          } catch (parseError) { // Handle cases where error response isn't valid JSON
            // console.error("API Error (Non-JSON):", response.status, await response.text()); // Log raw error text
            throw new Error(`API request failed: ${response.status} - ${await response.text() || response.statusText}`);
          }
        }

      } catch (error) {
        console.error('Prediction failed:', error);
        throw error;
      }
    }
  };

  console.log('Successfully initialized prediction client with google-auth-library');
  
} catch (error) {
  console.error('Client initialization failed:', error);
  throw error;
}



// Image Generation
export async function generateImage(prompt: string) {
  try {
    console.log('Starting image generation with prompt length:', prompt.length);
    
    const request = {
      endpoint: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002`,
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9',
        mimeType: 'image/png'
      },
    };
   
    const [response] = await predictionClient.predict(request);

    if (response?.predictions?.[0]?.bytesBase64Encoded) {
      return response.predictions[0].bytesBase64Encoded;
    } else {
      console.warn("No valid base64 image data in response");
      return null;
    }
  } catch (error) {
    console.error('Image generation failed:', error);
    throw error;
  }
}

// Supabase Storage Upload
export async function uploadImageToSupabase(imageBase64: string, supabase: SupabaseClient) {
  if (!imageBase64) {
    console.log('No image data provided for upload');
    return null;
  }

  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const fileName = `report-images/${uuidv4()}.png`;

    const { data, error } = await supabase
      .storage
      .from('reports')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('reports')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload image:', error);
    return null;
  }
}

// User Data Fetching
export async function fetchUserFollows(user: User, supabase: SupabaseClient): Promise<Follows> {
  const [{ data: teamFollows }, { data: playerFollows }] = await Promise.all([
    supabase.from('team_follows').select('team_id').eq('user_id', user.id),
    supabase.from('player_follows').select('player_id').eq('user_id', user.id)
  ]);
  
  return { 
    teamFollows: teamFollows || [], 
    playerFollows: playerFollows || [] 
  };
}

// Report Content Generation
export async function generateReportContent(follows: Follows): Promise<ReportContent> {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
   
  const prompt = `Create an engaging MLB performance report with the following structure and style:

1. Start with a compelling headline that captures the most interesting storyline from the day's performances.

2. For each team (${JSON.stringify(follows.teamFollows)}):
   - Recent performance trends (last 5 games)
   - Standout moments from recent games
   - Key statistical insights that tell a story (not just raw numbers)
   - Current storylines or narratives around the team
   - Areas of excellence and areas needing improvement
   - Upcoming matchups and what to watch for

3. For each player (${JSON.stringify(follows.playerFollows)}):
   - Recent performance highlights
   - Career milestone updates
   - Comparison to their historical averages
   - Impact on their team's success
   - Interesting statistics that provide context
   - Notable matchups or performances against specific opponents

4. Include a "What to Watch" section that:
   - Highlights upcoming interesting matchups
   - Points out potential milestone achievements
   - Identifies emerging trends
   - Makes data-driven predictions

Style guidelines:
- Write in an engaging, journalistic style
- Use storytelling to connect statistics to narratives
- Include relevant historical context
- Highlight human interest elements
- Make specific, insight-driven observations
- Use clear section headings for easy reading
- Include relevant MLB records or milestones for context

Format the response in HTML with appropriate tags for styling. Use <h1>, <h2>, <h3> for headlines and section headers, <p> for paragraphs, and <strong> for emphasis.`;

  const result = await model.generateContent(prompt);
  const reportText = await result.response.text();

  const imagePromptResult = await model.generateContent(`Based on this baseball report: ${reportText}
  Create a short, specific, detailed prompt (maximum 50 words) for an image that would best represent the main storyline or most exciting moment described in the report. Focus on action, emotion, and specific details. Make it vivid and clear. Do not include any real player or team names in the prompt.`);
  
  const imagePrompt = await imagePromptResult.response.text();

  return { reportText, imagePrompt };
}

// Report Saving
export async function saveReport(user: User, content: ReportContent, imageUrl: string | null, supabase: SupabaseClient) {
  const report = {
    user_id: user.id,
    content: content.reportText,
    image_url: imageUrl,
    type: 'daily',
    title: `MLB Daily Insider Report - ${new Date().toLocaleDateString()}`
  };

  const { data, error } = await supabase
    .from('reports')
    .insert([report])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save report: ${error.message}`);
  }

  return data;
}

// Email Sending
export async function sendEmail(user: User, report: Report) {
    if (!user.email) {
        console.log('No email address available for user, skipping email send');
        return;
      }
      
  const transporter = nodemailer.createTransport(emailConfig);
  
  try {
    await transporter.verify();
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #1a365d;">${report.title}</h1>
        ${report.image_url ? `
          <div style="margin: 20px 0;">
            <img src="${report.image_url}" 
                 alt="Daily Report Visualization" 
                 style="width: 100%; max-width: 800px; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
            />
          </div>
        ` : ''}
        <div style="line-height: 1.6;">
          ${report.content}
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
          <p>Your daily MLB report from BaseballGPT</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: user.email,
      subject: report.title,
      html: htmlContent
    });
  } catch (error) {
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

// Main Report Generation Function
export async function generateUserReport(user: User, supabase: SupabaseClient, storageClient?: SupabaseClient | null) {
    try {
    const follows = await fetchUserFollows(user, supabase);
    console.log(`Generating report for user ${user.id} with follows:`, follows);
    
    if (!follows.teamFollows?.length && !follows.playerFollows?.length) {
      console.log(`User ${user.id} has no follows, skipping report generation`);
      return null;
    }

    const content = await generateReportContent(follows);
    let imageUrl = null;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // const credentials = await getGoogleCredentials(supabase);
        // const predictionClient = await initPredictionClient(credentials);
        const imageBase64 = await generateImage(content.imagePrompt);
        
        if (imageBase64) {
          const clientToUse = storageClient || supabase;
          imageUrl = await uploadImageToSupabase(imageBase64, clientToUse);
        }
      } catch (imageError) {
        console.error('Image generation/upload failed:', imageError);
      }
    } else {
      console.log('Skipping image generation due to missing credentials');
    }

    const report = await saveReport(user, content, imageUrl, supabase);
    await sendEmail(user, report);
    return report;
  } catch (error) {
    console.error(`Failed to generate report for user ${user.id}:`, error);
    return null;
  }
}