import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type Tesserato = {
  id: string
  stagioneId: string
  numeroMaglia: number | null
  visitaScadenza: string | null
  visitaConsegnataIl: string | null
  /**
   * Materiale sportivo. Viaggia sulla riga del tesserato e non in una mappa a
   * parte come quota e visita, perché non viene da una vista: sono due colonne
   * di `tesseramenti`, cioè della tabella che questa query legge già. Gli
   * elenchi lo mostrano senza una lettura in più.
   */
  materialeConsegnato: boolean
  materialeTaglia: string | null
  note: string | null
  persona: { id: string; cognome: string; nome: string; dataNascita: string | null }
  squadra: { id: string; nome: string } | null
}

// Stringa letterale in un'unica espressione: concatenandola il tipo diventa
// `string` e supabase-js non deduce più la forma del risultato.
const CAMPI = `
  id, stagione_id, numero_maglia, visita_scadenza, visita_consegnata_il,
  materiale_consegnato, materiale_taglia, note,
  persona:persone!tesseramenti_persona_id_fkey (id, cognome, nome, data_nascita),
  squadra:squadre!tesseramenti_squadra_di_stagione (id, nome)
`

type Riga = {
  id: string
  stagione_id: string
  numero_maglia: number | null
  visita_scadenza: string | null
  visita_consegnata_il: string | null
  materiale_consegnato: boolean
  materiale_taglia: string | null
  note: string | null
  persona: { id: string; cognome: string; nome: string; data_nascita: string | null }
  squadra: { id: string; nome: string } | null
}

function daRiga(r: Riga): Tesserato {
  return {
    id: r.id,
    stagioneId: r.stagione_id,
    numeroMaglia: r.numero_maglia,
    visitaScadenza: r.visita_scadenza,
    visitaConsegnataIl: r.visita_consegnata_il,
    materialeConsegnato: r.materiale_consegnato,
    materialeTaglia: r.materiale_taglia,
    note: r.note,
    persona: {
      id: r.persona.id,
      cognome: r.persona.cognome,
      nome: r.persona.nome,
      dataNascita: r.persona.data_nascita,
    },
    squadra: r.squadra ? { id: r.squadra.id, nome: r.squadra.nome } : null,
  }
}

/** Cognome poi nome, come si legge un elenco di iscritti. */
function perCognome(a: Tesserato, b: Tesserato): number {
  return (
    a.persona.cognome.localeCompare(b.persona.cognome, 'it') ||
    a.persona.nome.localeCompare(b.persona.nome, 'it')
  )
}

export async function elencaTesseramenti(
  db: Db,
  stagioneId: string,
  filtro: { squadraId?: string; senzaSquadra?: boolean } = {},
): Promise<Tesserato[]> {
  let query = db.from('tesseramenti').select(CAMPI).eq('stagione_id', stagioneId)
  if (filtro.squadraId) query = query.eq('squadra_id', filtro.squadraId)
  // `squadra_id` nullo è un caso reale: si tessera prima e si smista dopo.
  if (filtro.senzaSquadra) query = query.is('squadra_id', null)

  const { data, error } = await query
  if (error) throw error
  // L'ordinamento è in TypeScript: PostgREST ordina le righe innestate dentro
  // ciascun genitore, non i genitori per una colonna del figlio.
  return data.map(daRiga).sort(perCognome)
}

export async function tesseramentoPerId(db: Db, id: string): Promise<Tesserato | null> {
  const { data, error } = await db.from('tesseramenti').select(CAMPI).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function creaTesseramento(
  db: Db,
  dati: {
    personaId: string
    stagioneId: string
    squadraId?: string | null
    numeroMaglia?: number | null
  },
): Promise<Tesserato> {
  const { data, error } = await db
    .from('tesseramenti')
    .insert({
      persona_id: dati.personaId,
      stagione_id: dati.stagioneId,
      squadra_id: dati.squadraId ?? null,
      numero_maglia: dati.numeroMaglia ?? null,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return daRiga(data)
}

/**
 * Spostare un tesserato che ha già presenze con la squadra attuale viene
 * rifiutato dal vincolo differito `presenze_tesseramento_di_squadra`: quelle
 * presenze appartengono alla squadra dove sono state raccolte. Con PostgREST
 * ogni richiesta è la sua transazione, quindi la violazione torna qui come
 * 23503 al commit.
 */
export async function assegnaSquadra(
  db: Db,
  id: string,
  squadraId: string | null,
): Promise<void> {
  const { error } = await db.from('tesseramenti').update({ squadra_id: squadraId }).eq('id', id)
  if (error) throw error
}

/**
 * Squadra e numero in **una** UPDATE, non in due.
 *
 * Due chiamate sono due richieste PostgREST, quindi due transazioni: se la
 * seconda fallisce, lo spostamento resta applicato e il numero no. E l'ordine
 * non ha una scelta giusta — scrivere prima il numero lo confronta con la
 * squadra vecchia e rifiuta un valore che nella nuova è libero; scrivere prima
 * la squadra porta lì un numero già occupato. In una sola UPDATE l'indice
 * unico valuta la riga finale, che è l'unica combinazione che conta.
 */
export async function aggiornaAssegnazione(
  db: Db,
  id: string,
  dati: { squadraId: string | null; numeroMaglia: number | null },
): Promise<void> {
  const { error } = await db
    .from('tesseramenti')
    .update({ squadra_id: dati.squadraId, numero_maglia: dati.numeroMaglia })
    .eq('id', id)
  if (error) throw error
}

export async function impostaNumeroMaglia(
  db: Db,
  id: string,
  numero: number | null,
): Promise<void> {
  const { error } = await db.from('tesseramenti').update({ numero_maglia: numero }).eq('id', id)
  if (error) throw error
}

/**
 * Consegna e taglia in una sola UPDATE, per la stessa ragione di
 * `impostaVisita`: sono i due campi di un unico gesto — la segreteria apre il
 * pannello e dice cosa sa — e con PostgREST due chiamate sono due transazioni,
 * quindi la seconda che fallisce lascerebbe scritto metà di quello che si è
 * visto salvare.
 *
 * La taglia **non** si azzera quando la consegna è negata: non esiste nessun
 * vincolo di coerenza da rispettare, e cancellarla costringerebbe a chiederla
 * di nuovo al ragazzo per un materiale già ordinato con quella misura.
 */
export async function impostaMateriale(
  db: Db,
  id: string,
  dati: { consegnato: boolean; taglia: string | null },
): Promise<void> {
  const { error } = await db
    .from('tesseramenti')
    .update({ materiale_consegnato: dati.consegnato, materiale_taglia: dati.taglia })
    .eq('id', id)
  if (error) throw error
}

export async function rimuoviTesseramento(db: Db, id: string): Promise<void> {
  const { error } = await db.from('tesseramenti').delete().eq('id', id)
  if (error) throw error
}

/**
 * Chi occupa quel numero in quella squadra, per nome e cognome. Serve al
 * messaggio d'errore: "il 10 è già assegnato" costringe a cercare a mano chi
 * ce l'ha, e chi lo cerca a mano lo cerca ogni volta.
 */
export async function chiHaLaMaglia(
  db: Db,
  squadraId: string,
  numero: number,
): Promise<string | null> {
  const { data, error } = await db
    .from('tesseramenti')
    .select('persona:persone!tesseramenti_persona_id_fkey (cognome, nome)')
    .eq('squadra_id', squadraId)
    .eq('numero_maglia', numero)
    .maybeSingle()
  if (error) throw error
  return data ? `${data.persona.cognome} ${data.persona.nome}` : null
}
