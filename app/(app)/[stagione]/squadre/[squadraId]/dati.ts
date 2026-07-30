import { cache } from 'react'
import { squadraPerId, type Squadra } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Condivisa fra il layout (che decide il 404) e la pagina, deduplicata per
 * richiesta. Il controllo sulla forma dell'uuid evita il 22P02 di Postgres,
 * che sarebbe un 500 al posto di un 404.
 */
export const caricaSquadra = cache(async (id: string): Promise<Squadra | null> => {
  if (!UUID.test(id)) return null
  const db = await supabaseServer()
  return squadraPerId(db, id)
})
