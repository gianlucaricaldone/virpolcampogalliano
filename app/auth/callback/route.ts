import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error_code = requestUrl.searchParams.get('error_code')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('[Auth Callback] URL:', requestUrl.toString())
  console.log('[Auth Callback] Code:', code)
  console.log('[Auth Callback] Error code:', error_code)
  console.log('[Auth Callback] Error description:', error_description)

  // Se c'è un errore specifico dall'URL, gestiscilo
  if (error_code) {
    let errorMessage = 'auth_failed'
    
    switch (error_code) {
      case 'otp_expired':
        errorMessage = 'otp_expired'
        break
      case 'signup_disabled':
        errorMessage = 'signup_disabled'
        break
      default:
        errorMessage = 'auth_failed'
    }
    
    console.log('[Auth Callback] Redirecting to login with error:', errorMessage)
    return NextResponse.redirect(new URL(`/auth/login?error=${errorMessage}`, request.url))
  }

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      console.log('[Auth Callback] Exchange result:', { 
        hasSession: !!data?.session, 
        hasUser: !!data?.user,
        error: error?.message 
      })
      
      if (!error && data?.session) {
        // Successful authentication, redirect to dashboard
        console.log('[Auth Callback] Success, redirecting to dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        console.log('[Auth Callback] Exchange failed:', error?.message)
        return NextResponse.redirect(new URL('/auth/login?error=session_failed', request.url))
      }
    } catch (err) {
      console.error('[Auth Callback] Exception during exchange:', err)
      return NextResponse.redirect(new URL('/auth/login?error=exchange_error', request.url))
    }
  }

  // No code provided
  console.log('[Auth Callback] No code provided')
  return NextResponse.redirect(new URL('/auth/login?error=no_code', request.url))
}