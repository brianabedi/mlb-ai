// app/auth/callback/route.ts
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'
    const origin = new URL(request.url).origin

    const supabase = await createClient()

    if (code) {
      // Handle the exchangeCodeForSession flow
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(new URL(next, origin))
      }
    }

    // If no code or if code exchange failed, check for OTP verification flow
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      })
      
      if (!error) {
        return NextResponse.redirect(new URL(next, origin))
      }
    }

    // If we get here, neither verification method worked
    console.error('Authentication failed - no valid verification method found')
    return NextResponse.redirect(new URL('/auth-code-error', origin))
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.redirect(new URL('/auth-code-error', origin))
  }
}