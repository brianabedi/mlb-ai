import Script from 'next/script'
import { createClient } from '@/utils/supabase/client'
import { CredentialResponse } from 'google-one-tap'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const OneTapComponent = () => {
  const supabase = createClient()
  const router = useRouter()
  const [isGoogleReady, setIsGoogleReady] = useState(false)

  const generateNonce = async (): Promise<string[]> => {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    const encoder = new TextEncoder()
    const encodedNonce = encoder.encode(nonce)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return [nonce, hashedNonce]
  }

  useEffect(() => {
    if (!isGoogleReady) return // Ensure Google script is ready

    const initializeGoogleOneTap = async () => {
      console.log('Initializing Google One Tap')

      const [nonce, hashedNonce] = await generateNonce()
      console.log('Nonce:', nonce, hashedNonce)

      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        return
      }
      if (data.session) {
        console.log('User already signed in')
        return
      }

      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: async (response: CredentialResponse) => {
            try {
              const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
                nonce,
              })

              if (error) throw error
              console.log('Login successful:', data)
              router.push('/')
            } catch (error) {
              console.error('Error logging in with Google One Tap:', error)
            }
          },
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
        })
        window.google.accounts.id.prompt()
      } else {
        console.error('Google API is not available')
      }
    }

    initializeGoogleOneTap()
  }, [isGoogleReady]) // Runs when script is loaded

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={() => setIsGoogleReady(true)}
        strategy="afterInteractive"
      />
      <div id="oneTap" className="fixed top-0 right-0 z-[100]" />
    </>
  )
}

export default OneTapComponent
