import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const schema = z.object({
  VECCHIO_SUPABASE_URL: z.string().url(),
  VECCHIO_SERVICE_ROLE_KEY: z.string().min(1),
})

/**
 * Client del progetto VECCHIO, solo lettura per contratto: questo modulo non
 * espone il client, espone `leggiTutto`, e `leggiTutto` fa solo select.
 * Nessun tipo generato: lo schema vecchio non ha types nel repo nuovo, le
 * forme sono dichiarate a mano in tipi.ts e validate dall'uso.
 */
function clientVecchio() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    throw new Error(
      'VECCHIO_SUPABASE_URL o VECCHIO_SERVICE_ROLE_KEY assenti: vanno in .env.local, mai committate.',
    )
  }
  return createClient(esito.data.VECCHIO_SUPABASE_URL, esito.data.VECCHIO_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

const PAGINA = 1000

/** Legge una tabella intera, paginando: PostgREST tronca a 1000 righe. */
export async function leggiTutto<T>(tabella: string, colonne: string): Promise<T[]> {
  const db = clientVecchio()
  const righe: T[] = []
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db.from(tabella).select(colonne).range(da, da + PAGINA - 1)
    if (error) throw new Error(`lettura di ${tabella} fallita: ${error.message}`)
    righe.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return righe
}
