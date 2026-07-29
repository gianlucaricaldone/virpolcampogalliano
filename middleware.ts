import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Fa una cosa sola: rinnova il cookie di sessione e manda al login chi non è
 * autenticato. Nessun controllo di ruolo — il vecchio sistema aveva un
 * matcher su /admin/* mentre le pagine stavano sotto /dashboard/admin/*, e il
 * controllo non scattava mai. I ruoli si verificano nelle Server Action e
 * nelle RLS.
 */
const PUBBLICHE = ['/', '/squadre', '/contatti', '/dove-siamo', '/login']

export async function middleware(richiesta: NextRequest) {
  let risposta = NextResponse.next({ request: richiesta })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => richiesta.cookies.getAll(),
        setAll: (elenco) => {
          for (const { name, value } of elenco) richiesta.cookies.set(name, value)
          risposta = NextResponse.next({ request: richiesta })
          for (const { name, value, options } of elenco) risposta.cookies.set(name, value, options)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const percorso = richiesta.nextUrl.pathname
  const pubblica = PUBBLICHE.includes(percorso)

  if (!user && !pubblica) {
    const destinazione = richiesta.nextUrl.clone()
    destinazione.pathname = '/login'
    return NextResponse.redirect(destinazione)
  }
  if (user && percorso === '/login') {
    const destinazione = richiesta.nextUrl.clone()
    destinazione.pathname = '/gestione'
    return NextResponse.redirect(destinazione)
  }
  return risposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
