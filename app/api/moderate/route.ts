// app/api/moderate/route.ts
import { analyzeToxicity } from '@/utils/perspective';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    
    // Analyze the content
    const scores = await analyzeToxicity(content);
    
    // Define thresholds for different types of content
    const THRESHOLDS = {
      TOXICITY: 0.7,
      SEVERE_TOXICITY: 0.5,
      IDENTITY_ATTACK: 0.5,
      INSULT: 0.7,
      PROFANITY: 0.8,
      THREAT: 0.5
    };

    // Check if any threshold is exceeded
    const violations = Object.entries(scores).filter(([key, score]) => {
      const threshold = THRESHOLDS[key.toUpperCase() as keyof typeof THRESHOLDS];
      return score > threshold;
    });

    if (violations.length > 0) {
      return NextResponse.json({
        allowed: false,
        reason: `Message contains ${violations.map(([type]) => type).join(', ')}`,
        scores
      });
    }

    return NextResponse.json({ allowed: true, scores });
  } catch (error) {
    console.error('Moderation error:', error);
    // If the API fails, we'll allow the message but log the error
    return NextResponse.json({ allowed: true, error: 'Moderation service unavailable' });
  }
}