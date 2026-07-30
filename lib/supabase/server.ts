import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { env } from '@/lib/env'
import type { Database } from '@/lib/db/types'

export type Db = Awaited<ReturnType<typeof supabaseServer>>

/**
 * Un client per richiesta, non uno per chiamante.
 *
 * `React.cache` è request-scoped e senza TTL: layout e pagine che lo chiedono
 * più volte ricevono la stessa istanza, e i cookie si leggono una volta sola.
 * Non è una cache di autenticazione — quella resta vietata: nulla sopravvive
 * alla richiesta, e `getSessione` continua a interrogare il server Auth.
 */
export const supabaseServer = cache(async () => {
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
})
