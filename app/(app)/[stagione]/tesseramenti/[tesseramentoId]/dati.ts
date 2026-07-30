import { cache } from 'react'
import { tesseramentoPerId, type Tesserato } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Condivisa fra layout e pagina, deduplicata per richiesta. */
export const caricaTesserato = cache(async (id: string): Promise<Tesserato | null> => {
  if (!UUID.test(id)) return null
  const db = await supabaseServer()
  return tesseramentoPerId(db, id)
})
