// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function fetchPlayerStats(playerId: number) {
  try {
    const [battingResponse, pitchingResponse] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=hitting`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=pitching`)
    ]);

    return {
      batting: await battingResponse.json(),
      pitching: await pitchingResponse.json()
    };
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return null;
  }
}

async function fetchTeamStats(teamId: number) {
  try {
    const response = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching,hitting`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching stats for team ${teamId}:`, error);
    return null;
  }
}

async function generateReport(userId: string) {
  const supabase = await createClient();
  
  // Fetch user's followed teams and players
  const [{ data: teamFollows }, { data: playerFollows }] = await Promise.all([
    supabase.from('team_follows').select('team_id').eq('user_id', userId),
    supabase.from('player_follows').select('player_id').eq('user_id', userId)
  ]);

  // Fetch stats for all followed entities
  const teamStats = await Promise.all(
    (teamFollows || []).map(follow => fetchTeamStats(follow.team_id))
  );

  const playerStats = await Promise.all(
    (playerFollows || []).map(follow => fetchPlayerStats(follow.player_id))
  );

  // Generate report using Gemini
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = `Generate a comprehensive MLB performance report based on the following data:
    Team Stats: ${JSON.stringify(teamStats)}
    Player Stats: ${JSON.stringify(playerStats)}
    
    Format the report in HTML with appropriate sections for teams and players.
    Include relevant statistics, trends, and notable performances.`;

  const result = await model.generateContent(prompt);
  const reportContent = await result.response.text();

  // Save report to database
  const { data: report } = await supabase
    .from('reports')
    .insert([{
      user_id: userId,
      content: reportContent,
      type: 'daily',
      title: `Daily Report - ${new Date().toLocaleDateString()}`
    }])
    .select()
    .single();

  return report;
}

async function sendReportEmail(report: any, userEmail: string) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: report.title,
    html: `
      <h1>${report.title}</h1>
      <p>Click <a href="${process.env.NEXT_PUBLIC_BASE_URL}/reports/${report.id}">here</a> to view the full report.</p>
      <hr>
      ${report.content}
    `
  };

  await transporter.sendMail(mailOptions);
}

// GET handler for fetching reports
export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: reports } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// POST handler for generating new report
export async function POST() {
  const supabase = await createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const report = await generateReport(user.id);
    await sendReportEmail(report, user.email!);

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}