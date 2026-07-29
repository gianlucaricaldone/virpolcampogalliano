import { createClient } from '@supabase/supabase-js'
import { envScript } from '@/scripts/env'
import type { Database } from '@/lib/db/types'

/**
 * Client con chiave service role: ignora ogni RLS.
 * Usabile SOLO dagli script in scripts/. Una regola ESLint impedisce di
 * importarlo da app/, components/ e lib/repos/.
 */
export function supabaseAdmin() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = envScript()
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
