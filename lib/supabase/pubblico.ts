import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

/**
 * Client anonimo per le pagine pubbliche statiche. Niente cookie e niente
 * sessione: supabaseServer passa da cookies() e renderebbe la rotta
 * dinamica, rompendo il revalidate. La chiave anon è pubblica per natura
 * (viaggia in ogni bundle browser): qui non c'è nulla da recintare.
 */
export function clientPubblico() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
