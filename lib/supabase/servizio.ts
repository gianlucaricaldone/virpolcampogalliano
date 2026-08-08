import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/db/types'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

/**
 * Client con chiave service role per l'applicazione. Ignora ogni RLS.
 *
 * Distinto da lib/supabase/admin, che resta agli script e legge l'ambiente da
 * scripts/env: quel modulo non deve diventare importabile da app/ nemmeno per
 * sbaglio. Qui l'ambiente si valida in proprio.
 *
 * Serve a una cosa sola: creare e aggiornare utenti in auth.users, che non è
 * raggiungibile con la chiave anon. Tutto il resto — anche l'inserimento in
 * profili subito dopo — passa dal client normale, sotto RLS: se una policy
 * regredisse, un test se ne accorgerebbe.
 */
export function supabaseServizio() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    // Messaggio esplicito: un deploy senza la variabile deve rompersi al primo
    // uso con una frase leggibile, non restituire 401 opachi da Auth.
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY assente o non valida: la gestione degli utenti non può funzionare.',
    )
  }
  return createClient<Database>(
    esito.data.NEXT_PUBLIC_SUPABASE_URL,
    esito.data.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
