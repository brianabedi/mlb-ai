// app/api/cron/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function generateUserReport(user: any, supabase: any) {
  try {
    // Fetch user's followed entities
    const [{ data: teamFollows }, { data: playerFollows }] = await Promise.all([
      supabase.from('team_follows').select('team_id').eq('user_id', user.id),
      supabase.from('player_follows').select('player_id').eq('user_id', user.id)
    ]);

    // Generate report content using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Generate daily MLB performance report for teams ${JSON.stringify(teamFollows)} and players ${JSON.stringify(playerFollows)}`;
    
    const result = await model.generateContent(prompt);
    const content = await result.response.text();

    // Save report
    const { data: report } = await supabase
      .from('reports')
      .insert([{
        user_id: user.id,
        content,
        type: 'daily',
        title: `Daily Report - ${new Date().toLocaleDateString()}`
      }])
      .select()
      .single();

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: report.title,
      html: `<h1>${report.title}</h1>${report.content}`
    });

    return report;
  } catch (error) {
    console.error(`Failed to generate report for user ${user.id}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(cookies());

  try {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    
    const reports = await Promise.all(
      users.map(user => generateUserReport(user, supabase))
    );

    return NextResponse.json({
      success: true,
      reportsGenerated: reports.filter(Boolean).length,
      totalUsers: users.length
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}