import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'
import { statoQuote, type RigaQuota } from '@/lib/repos/quote'
import { statoVisite, type RigaVisita } from '@/lib/repos/visite'

type Db = SupabaseClient<Database>

export type Scadenze = {
  /** Nullo quando non sono state chieste: è il caso dell'allenatore. */
  quote: RigaQuota[] | null
  visite: RigaVisita[]
}

/**
 * Ciò che serve a chi sollecita: quote non saldate e visite mancanti, scadute
 * o in scadenza. Nessuna regola nuova — quali righe siano "aperte" lo dicono
 * `v_quote` e `v_visite`, qui si scelgono le due domande e si fanno insieme.
 *
 * `includiQuote: false` non nasconde una colonna: non chiede il dato. Un
 * allenatore che ricevesse le righe e le vedesse filtrate lato interfaccia
 * avrebbe comunque le cifre nel payload della pagina — e in questo caso
 * leggerebbe zeri, perché non ha policy sulle tabelle finanziarie, il che è
 * peggio: numeri finti presentati come veri.
 */
export async function scadenzeStagione(
  db: Db,
  stagioneId: string,
  opzioni: { squadraId?: string; includiQuote: boolean },
): Promise<Scadenze> {
  const [quote, visite] = await Promise.all([
    opzioni.includiQuote
      ? statoQuote(db, stagioneId, { squadraId: opzioni.squadraId, soloNonSaldate: true })
      : Promise.resolve(null),
    statoVisite(db, stagioneId, { squadraId: opzioni.squadraId, soloDaSistemare: true }),
  ])
  return { quote, visite }
}
