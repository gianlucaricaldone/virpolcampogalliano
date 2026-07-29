import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Database } from '@/lib/db/types'

export type Db = Awaited<ReturnType<typeof supabaseServer>>

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient<Database>(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (elenco) => {
          try {
            for (const { name, value, options } of elenco) store.set(name, value, options)
          } catch {
            // I Server Component non possono scrivere cookie: il rinnovo del
            // token avviene nel middleware.
          }
        },
      },
    },
  )
}
