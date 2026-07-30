import { notFound } from 'next/navigation'
import { cache } from 'react'
import { stagionePerCodice, type Stagione } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * La stagione del segmento di rotta, letta una volta per richiesta.
 * `React.cache` è request-scoped e senza TTL: il layout e ogni pagina sotto di
 * lui la chiedono liberamente senza moltiplicare le query, e nulla sopravvive
 * alla richiesta — che è il motivo per cui non è un `Map` a livello di modulo.
 */
export const caricaStagione = cache(async (codice: string): Promise<Stagione | null> => {
  const db = await supabaseServer()
  return stagionePerCodice(db, codice)
})

/**
 * Da usare nelle pagine sotto `[stagione]`: il layout ha già prodotto il 404
 * per un codice inesistente, questa serve a restringere il tipo senza rifare
 * la query.
 */
export async function stagioneRichiesta(codice: string): Promise<Stagione> {
  const stagione = await caricaStagione(codice)
  if (!stagione) notFound()
  return stagione
}
