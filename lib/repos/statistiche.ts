import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type StatisticaGiocatore = {
  tesseramentoId: string
  persona: { id: string; cognome: string; nome: string }
  squadra: { id: string; nome: string } | null
  seduteSquadra: number
  presenti: number
  assenti: number
  giustificati: number
  infortuni: number
  nonRegistrate: number
  /** Nulla quando la squadra non ha sedute: non è zero, è "non calcolabile". */
  percentuale: number | null
}

export type StatisticaSquadra = {
  squadraId: string
  nome: string
  tesserati: number
  sedute: number
  presenti: number
  nonRegistrate: number
  percentuale: number | null
}

const CAMPI = `
  tesseramento_id, sedute_squadra, presenti, assenti, giustificati, infortuni,
  non_registrate, percentuale,
  persona:persone!tesseramenti_persona_id_fkey (id, cognome, nome),
  squadra:squadre!tesseramenti_squadra_di_stagione (id, nome)
`

/**
 * Percentuali per giocatore, **lette** da `v_presenze`.
 *
 * `nonRegistrate` viaggia accanto alla percentuale e non va nascosto: il
 * denominatore sono tutte le sedute della squadra, comprese quelle in cui per
 * quel giocatore non esiste una riga. Chi si tessera a gennaio ha percentuale
 * bassa e nonRegistrate alto, ed è la lettura onesta — aggiustare il
 * denominatore per farla sembrare migliore è il difetto per cui le statistiche
 * del sistema vecchio non erano attendibili.
 */
export async function statistichePerGiocatore(
  db: Db,
  stagioneId: string,
  filtro: { squadraId?: string } = {},
): Promise<StatisticaGiocatore[]> {
  let query = db.from('v_presenze').select(CAMPI).eq('stagione_id', stagioneId)
  if (filtro.squadraId) query = query.eq('squadra_id', filtro.squadraId)

  const { data, error } = await query
  if (error) throw error

  return data
    .map((r) => ({
      tesseramentoId: r.tesseramento_id!,
      persona: { id: r.persona!.id, cognome: r.persona!.cognome, nome: r.persona!.nome },
      squadra: r.squadra ? { id: r.squadra.id, nome: r.squadra.nome } : null,
      seduteSquadra: r.sedute_squadra ?? 0,
      presenti: r.presenti ?? 0,
      assenti: r.assenti ?? 0,
      giustificati: r.giustificati ?? 0,
      infortuni: r.infortuni ?? 0,
      nonRegistrate: r.non_registrate ?? 0,
      percentuale: r.percentuale === null ? null : Number(r.percentuale),
    }))
    .sort(
      (a, b) =>
        // Percentuale decrescente; chi non ne ha una va in fondo, non in cima
        // come farebbe un null trattato da zero in una sottrazione.
        (b.percentuale ?? -1) - (a.percentuale ?? -1) ||
        a.persona.cognome.localeCompare(b.persona.cognome, 'it'),
    )
}

/**
 * Media per squadra, letta da `v_presenze_squadra`: non è la media delle righe
 * dei giocatori ricalcolata qui. Il nome della squadra si aggiunge dopo — la
 * vista espone `squadra_id` come colonna propria e non come chiave esterna,
 * quindi PostgREST non sa innestare `squadre`.
 */
export async function statistichePerSquadra(
  db: Db,
  stagioneId: string,
): Promise<StatisticaSquadra[]> {
  const [statistiche, squadre] = await Promise.all([
    db
      .from('v_presenze_squadra')
      .select('squadra_id, tesserati, sedute, presenti, non_registrate, percentuale')
      .eq('stagione_id', stagioneId),
    db.from('squadre').select('id, nome').eq('stagione_id', stagioneId),
  ])
  if (statistiche.error) throw statistiche.error
  if (squadre.error) throw squadre.error

  const nomi = new Map(squadre.data.map((s) => [s.id, s.nome]))

  return statistiche.data
    .map((r) => ({
      squadraId: r.squadra_id!,
      nome: nomi.get(r.squadra_id!) ?? '—',
      tesserati: r.tesserati ?? 0,
      sedute: r.sedute ?? 0,
      presenti: r.presenti ?? 0,
      nonRegistrate: r.non_registrate ?? 0,
      percentuale: r.percentuale === null ? null : Number(r.percentuale),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}
