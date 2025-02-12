// app/api/cron/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateUserReport } from '@/utils/report-generation';

export const maxDuration = 60;

const dbConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export async function GET(request: Request) {
  console.log('Cron job started');
  
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createClient(dbConfig.supabaseUrl!, dbConfig.supabaseKey!);

  try {
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw new Error(`Failed to fetch users: ${userError.message}`);

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