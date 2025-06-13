import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req, res })

  console.log('[Middleware] Processing:', req.nextUrl.pathname)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Se l'utente sta provando ad accedere alla dashboard senza sessione
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      console.log('[Middleware] No session for dashboard, redirecting to login')
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
    console.log('[Middleware] Session found for dashboard access')
  }

  // Se l'utente ha una sessione e sta provando ad accedere al login
  if (req.nextUrl.pathname.startsWith('/auth/login')) {
    if (session) {
      console.log('[Middleware] User already logged in, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Admin-only routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      console.log('[Middleware] No session for admin, redirecting to login')
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!user || user.role !== 'admin') {
      console.log('[Middleware] User not admin, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/auth/login']
}