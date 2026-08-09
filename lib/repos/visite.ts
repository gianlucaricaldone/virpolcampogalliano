import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type StatoVisita = 'mancante' | 'scaduta' | 'in_scadenza' | 'valida'

export type RigaVisita = {
  tesseramentoId: string
  scadenza: string | null
  consegnataIl: string | null
  consegnata: boolean
  stato: StatoVisita
  giorniAllaScadenza: number | null
  persona: { id: string; cognome: string; nome: string }
  squadra: { id: string; nome: string } | null
}

const CAMPI = `
  tesseramento_id, visita_scadenza, visita_consegnata_il, visita_consegnata,
  stato_visita, giorni_alla_scadenza,
  persona:persone!tesseramenti_persona_id_fkey (id, cognome, nome),
  squadra:squadre!tesseramenti_squadra_di_stagione (id, nome)
`

type RigaVista = {
  tesseramento_id: string | null
  visita_scadenza: string | null
  visita_consegnata_il: string | null
  visita_consegnata: boolean | null
  stato_visita: string | null
  giorni_alla_scadenza: number | null
  persona: { id: string; cognome: string; nome: string } | null
  squadra: { id: string; nome: string } | null
}

function daRiga(r: RigaVista): RigaVisita {
  return {
    tesseramentoId: r.tesseramento_id!,
    scadenza: r.visita_scadenza,
    consegnataIl: r.visita_consegnata_il,
    consegnata: r.visita_consegnata ?? false,
    stato: (r.stato_visita ?? 'mancante') as StatoVisita,
    giorniAllaScadenza: r.giorni_alla_scadenza,
    persona: {
      id: r.persona!.id,
      cognome: r.persona!.cognome,
      nome: r.persona!.nome,
    },
    squadra: r.squadra ? { id: r.squadra.id, nome: r.squadra.nome } : null,
  }
}

/** Prima chi non ha una visita, poi le più scadute, infine le valide. */
const URGENZA: Record<StatoVisita, number> = {
  mancante: 0,
  scaduta: 1,
  in_scadenza: 2,
  valida: 3,
}

function perUrgenza(a: RigaVisita, b: RigaVisita): number {
  if (URGENZA[a.stato] !== URGENZA[b.stato]) return URGENZA[a.stato] - URGENZA[b.stato]
  // A pari stato, prima chi ha meno giorni davanti. Le mancanti non hanno
  // giorni: restano nell'ordine alfabetico dei cognomi.
  const giorniA = a.giorniAllaScadenza ?? 0
  const giorniB = b.giorniAllaScadenza ?? 0
  return giorniA - giorniB || a.persona.cognome.localeCompare(b.persona.cognome, 'it')
}

/**
 * Stato delle visite della stagione, **letto** da `v_visite`. La regola dei
 * quattro stati vive solo nella vista: qui si ordina e si rinomina, nulla di
 * più.
 */
export async function statoVisite(
  db: Db,
  stagioneId: string,
  filtro: { squadraId?: string; soloDaSistemare?: boolean } = {},
): Promise<RigaVisita[]> {
  let query = db.from('v_visite').select(CAMPI).eq('stagione_id', stagioneId)
  if (filtro.squadraId) query = query.eq('squadra_id', filtro.squadraId)
  if (filtro.soloDaSistemare) query = query.neq('stato_visita', 'valida')

  const { data, error } = await query
  if (error) throw error
  return data.map(daRiga).sort(perUrgenza)
}

export async function visitaPerTesseramento(
  db: Db,
  tesseramentoId: string,
): Promise<RigaVisita | null> {
  const { data, error } = await db
    .from('v_visite')
    .select(CAMPI)
    .eq('tesseramento_id', tesseramentoId)
    .maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

/**
 * Scadenza e consegna insieme, in una sola UPDATE: sono due facce dello stesso
 * gesto — il ragazzo porta il certificato — e scriverle separate lascerebbe
 * una consegna senza scadenza se la seconda chiamata fallisse.
 *
 * `visita_consegnata_il` è informativo e non entra in nessuno stato: i dati
 * storici da migrare non ce l'hanno.
 */
export async function impostaVisita(
  db: Db,
  tesseramentoId: string,
  dati: { scadenza: string | null; consegnataIl: string | null; consegnata: boolean },
): Promise<void> {
  const { error } = await db
    .from('tesseramenti')
    .update({
      visita_scadenza: dati.scadenza,
      // La bandiera vince sulla data: "non consegnata" con una data di consegna
      // è la combinazione che il vincolo visita_consegna_coerente rifiuta, e
      // l'interfaccia non la produce (il campo data compare solo su SÌ). Qui si
      // azzera invece di far arrivare al database un errore che l'utente non
      // saprebbe leggere.
      visita_consegnata_il: dati.consegnata ? dati.consegnataIl : null,
      visita_consegnata: dati.consegnata,
    })
    .eq('id', tesseramentoId)
  if (error) throw error
}
