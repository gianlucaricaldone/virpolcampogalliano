import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type Persona = {
  id: string
  nome: string
  cognome: string
  dataNascita: string | null
  codiceFiscale: string | null
  email: string | null
  telefono: string | null
  indirizzo: string | null
  citta: string | null
  cap: string | null
  provincia: string | null
  note: string | null
  attiva: boolean
}

/** Campi scrivibili. I facoltativi assenti restano invariati in aggiornamento. */
export type DatiPersona = {
  nome: string
  cognome: string
  dataNascita: string | null
  codiceFiscale?: string | null
  email?: string | null
  telefono?: string | null
  indirizzo?: string | null
  citta?: string | null
  cap?: string | null
  provincia?: string | null
  note?: string | null
}

const CAMPI =
  'id, nome, cognome, data_nascita, codice_fiscale, email, telefono, indirizzo, citta, cap, provincia, note, attiva'

type Riga = Pick<
  Database['public']['Tables']['persone']['Row'],
  | 'id' | 'nome' | 'cognome' | 'data_nascita' | 'codice_fiscale' | 'email' | 'telefono'
  | 'indirizzo' | 'citta' | 'cap' | 'provincia' | 'note' | 'attiva'
>

function daRiga(r: Riga): Persona {
  return {
    id: r.id,
    nome: r.nome,
    cognome: r.cognome,
    dataNascita: r.data_nascita,
    codiceFiscale: r.codice_fiscale,
    email: r.email,
    telefono: r.telefono,
    indirizzo: r.indirizzo,
    citta: r.citta,
    cap: r.cap,
    provincia: r.provincia,
    note: r.note,
    attiva: r.attiva,
  }
}

function aRiga(dati: Partial<DatiPersona>): Database['public']['Tables']['persone']['Update'] {
  const riga: Database['public']['Tables']['persone']['Update'] = {}
  if (dati.nome !== undefined) riga.nome = dati.nome
  if (dati.cognome !== undefined) riga.cognome = dati.cognome
  if (dati.dataNascita !== undefined) riga.data_nascita = dati.dataNascita
  if (dati.codiceFiscale !== undefined) riga.codice_fiscale = dati.codiceFiscale
  if (dati.email !== undefined) riga.email = dati.email
  if (dati.telefono !== undefined) riga.telefono = dati.telefono
  if (dati.indirizzo !== undefined) riga.indirizzo = dati.indirizzo
  if (dati.citta !== undefined) riga.citta = dati.citta
  if (dati.cap !== undefined) riga.cap = dati.cap
  if (dati.provincia !== undefined) riga.provincia = dati.provincia
  if (dati.note !== undefined) riga.note = dati.note
  return riga
}

/** `%` e `_` digitati nella ricerca sono caratteri, non jolly. */
function perRicerca(testo: string): string {
  return `%${testo.replace(/[\\%_]/g, '\\$&')}%`
}

export async function elencaPersone(
  db: Db,
  filtro: { cognome?: string; soloAttive?: boolean } = {},
): Promise<Persona[]> {
  let query = db.from('persone').select(CAMPI)
  if (filtro.cognome) query = query.ilike('cognome', perRicerca(filtro.cognome))
  if (filtro.soloAttive) query = query.eq('attiva', true)

  const { data, error } = await query.order('cognome').order('nome')
  if (error) throw error
  return data.map(daRiga)
}

export async function personaPerId(db: Db, id: string): Promise<Persona | null> {
  const { data, error } = await db.from('persone').select(CAMPI).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function creaPersona(db: Db, dati: DatiPersona): Promise<Persona> {
  const { data, error } = await db
    .from('persone')
    .insert({
      ...aRiga(dati),
      nome: dati.nome,
      cognome: dati.cognome,
      data_nascita: dati.dataNascita,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return daRiga(data)
}

export async function aggiornaPersona(
  db: Db,
  id: string,
  dati: Partial<DatiPersona>,
): Promise<void> {
  const { error } = await db.from('persone').update(aRiga(dati)).eq('id', id)
  if (error) throw error
}

/**
 * Archiviazione soft. Le chiavi esterne verso `persone` sono `on delete
 * restrict` proprio per impedire la cancellazione: un giocatore con storico
 * non si cancella, si disattiva, altrimenti spariscono anche le sue presenze
 * e i suoi pagamenti.
 */
/**
 * Cancellazione vera, non archiviazione: serve solo a compensare un
 * tesseramento fallito subito dopo la creazione della persona, quando la riga
 * ha pochi millisecondi e nessun riferimento. Per togliere dall'anagrafica una
 * persona con una storia si usa `archiviaPersona`.
 *
 * `persone_del` è concessa al solo admin: chiamata da un dirigente questa
 * funzione non lancia — la RLS non fa errore su una delete che non trova righe
 * da cancellare — ma non cancella nulla. Chi la usa per compensare deve
 * rileggere, o accettare di registrare l'orfano: vedi
 * creaGiocatoreNellaSquadraAzione, che per questo controlla il numero di
 * maglia prima di creare la persona.
 */
export async function eliminaPersona(db: Db, id: string): Promise<void> {
  const { error } = await db.from('persone').delete().eq('id', id)
  if (error) throw error
}

export async function archiviaPersona(db: Db, id: string): Promise<void> {
  const { error } = await db.from('persone').update({ attiva: false }).eq('id', id)
  if (error) throw error
}

export async function riattivaPersona(db: Db, id: string): Promise<void> {
  const { error } = await db.from('persone').update({ attiva: true }).eq('id', id)
  if (error) throw error
}

export type StagioneStorico = {
  id: string
  codice: string
  etichetta: string
  dataInizio: string
}

export type Storico = {
  tesseramenti: {
    id: string
    numeroMaglia: number | null
    stagione: StagioneStorico
    squadra: { id: string; nome: string } | null
  }[]
  incarichi: {
    id: string
    ruolo: Database['public']['Enums']['ruolo_staff']
    stagione: StagioneStorico
    squadra: { id: string; nome: string }
  }[]
}

/**
 * Storico completo, tutte le stagioni. È la ragione per cui l'anagrafica è
 * separata dall'appartenenza: la persona è permanente, il tesseramento no.
 *
 * L'ordinamento è in TypeScript perché è presentazione, non una regola: la
 * stagione di un incarico si raggiunge solo passando dalla squadra
 * (incarichi_staff non ha una FK diretta verso stagioni, solo quella composita
 * verso squadre) e ordinare lato PostgREST su una tabella innestata due volte
 * costa più di quanto renda.
 */
export async function storicoPersona(db: Db, personaId: string): Promise<Storico> {
  const { data: tesseramenti, error: erroreTesseramenti } = await db
    .from('tesseramenti')
    // Stringa letterale in un'unica espressione: concatenandola con `+` il
    // tipo diventa `string` e supabase-js perde la capacità di dedurre la
    // forma del risultato, che degrada a GenericStringError.
    .select(`
      id, numero_maglia,
      stagione:stagioni!tesseramenti_stagione_id_fkey (id, codice, etichetta, data_inizio),
      squadra:squadre!tesseramenti_squadra_di_stagione (id, nome)
    `)
    .eq('persona_id', personaId)
  if (erroreTesseramenti) throw erroreTesseramenti

  const { data: incarichi, error: erroreIncarichi } = await db
    .from('incarichi_staff')
    .select(`
      id, ruolo,
      squadra:squadre!incarichi_squadra_di_stagione (
        id, nome, stagione:stagioni (id, codice, etichetta, data_inizio)
      )
    `)
    .eq('persona_id', personaId)
  if (erroreIncarichi) throw erroreIncarichi

  const perStagione = (a: { stagione: StagioneStorico }, b: { stagione: StagioneStorico }) =>
    b.stagione.dataInizio.localeCompare(a.stagione.dataInizio)

  return {
    tesseramenti: tesseramenti
      .map((t) => ({
        id: t.id,
        numeroMaglia: t.numero_maglia,
        stagione: daStagione(t.stagione),
        squadra: t.squadra ? { id: t.squadra.id, nome: t.squadra.nome } : null,
      }))
      .sort(perStagione),
    incarichi: incarichi
      .map((i) => ({
        id: i.id,
        ruolo: i.ruolo,
        stagione: daStagione(i.squadra.stagione),
        squadra: { id: i.squadra.id, nome: i.squadra.nome },
      }))
      .sort(perStagione),
  }
}

function daStagione(s: {
  id: string
  codice: string
  etichetta: string
  data_inizio: string
}): StagioneStorico {
  return { id: s.id, codice: s.codice, etichetta: s.etichetta, dataInizio: s.data_inizio }
}
