import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'

/**
 * env() (lib/env.ts) fa `schema.safeParse(process.env)`: nel bundle client
 * Next.js sostituisce ogni `process.env.NEXT_PUBLIC_*` con una stringa
 * letterale per singola proprietà, ma non fornisce un oggetto `process.env`
 * enumerabile — safeParse vedrebbe un oggetto vuoto e lancerebbe. Le due
 * variabili vanno quindi lette qui esplicitamente, come già fa middleware.ts.
 */
export function supabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
