import { cache } from 'react'
import { getFoglio, type Foglio } from '@/lib/repos/presenze'
import { supabaseServer } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Condiviso fra layout e pagina, deduplicato per richiesta. */
export const caricaFoglio = cache(async (sedutaId: string): Promise<Foglio | null> => {
  if (!UUID.test(sedutaId)) return null
  const db = await supabaseServer()
  return getFoglio(db, sedutaId)
})
