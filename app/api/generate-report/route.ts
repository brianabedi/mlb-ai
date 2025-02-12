// app/api/generate-report/route.js
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js';
import { generateUserReport } from '../cron/route';
import { cookies } from 'next/headers';


export async function POST(request: Request) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
              cookieStore.set({ name, value: '', ...options });
            },
          },
        }
      );

      // Service role client just for storage operations
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

  try {

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('User:', user);
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }


    const report = await generateUserReport(user, supabase, serviceClient);
    
    if (!report) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to generate report. Make sure you are following at least one team or player.' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Report generation failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}