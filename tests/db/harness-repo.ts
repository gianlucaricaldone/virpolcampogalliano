/**
 * Harness per i test dei repository.
 *
 * Perché non `inRollback` (tests/db/harness.ts): quello avvolge un `pg.Client`
 * e isola con BEGIN/ROLLBACK. I repository ricevono un `SupabaseClient`, che
 * parla HTTP a PostgREST; PostgREST prende una connessione dal pool per ogni
 * richiesta, quindi non esiste una sessione in cui un BEGIN possa vivere fra
 * due chiamate e non c'è nulla da annullare. L'isolamento qui è per id
 * tracciati: si registra ciò che si crea e si cancella alla fine, mai un
 * `delete().neq()` che porterebbe via anche il seed.
 *
 * L'autenticazione passa da `signInWithPassword`, non da un JWT firmato a mano
 * con il JWT_SECRET locale. Il secondo sarebbe più veloce di un round trip per
 * client, ma è un secondo modo di produrre un token: se domani Auth cambiasse
 * la forma dei claim (o il progetto passasse alle chiavi asimmetriche), i test
 * continuerebbero a passare su un percorso che l'applicazione non usa più.
 * Costo misurato: ~90 ms per client sull'istanza locale, su suite che ne
 * creano una manciata per file.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { afterAll } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

export type Db = SupabaseClient<Database>

/** Tabelle che l'harness sa cancellare. `utenti_auth` non è una tabella di public. */
export type TabellaTracciabile =
  | 'presenze'
  | 'pagamenti_quota'
  | 'quote_importi'
  | 'incarichi_staff'
  | 'tesseramenti'
  | 'sedute_allenamento'
  | 'squadre'
  | 'stagioni'
  | 'profili'
  | 'utenti_auth'
  | 'persone'

/**
 * Ordine inverso di dipendenza. Le cascade renderebbero superflue alcune di
 * queste cancellazioni, ma non tutte, e dipendere da quali sia quale significa
 * riscoprirlo a ogni migration: l'elenco è esplicito e completo.
 */
const ORDINE: readonly TabellaTracciabile[] = [
  'presenze',
  'pagamenti_quota',
  'quote_importi',
  'incarichi_staff',
  'tesseramenti',
  'sedute_allenamento',
  'squadre',
  'stagioni',
  'profili',
  'utenti_auth',
  'persone',
]

type Registrazione = { tabella: TabellaTracciabile; id: string }

let registro: Registrazione[] = []

let servizioMemo: Db | null = null

/** Client service role: predispone i dati e li rimuove. Scavalca le RLS. */
export function clientServizio(): Db {
  servizioMemo ??= createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  return servizioMemo
}

// Client senza tipi, per le sole cancellazioni: `from()` con un nome di
// tabella che è un'unione di stringhe non si tipizza su un client generico.
let pulitoreMemo: SupabaseClient | null = null
function clientPulizia(): SupabaseClient {
  pulitoreMemo ??= createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  return pulitoreMemo
}

/** Registra una riga da rimuovere a fine test. Restituisce l'id, per concatenare. */
export function traccia(tabella: TabellaTracciabile, id: string): string {
  registro.push({ tabella, id })
  return id
}

async function pulisciElenco(elenco: Registrazione[]): Promise<void> {
  if (elenco.length === 0) return
  const db = clientPulizia()
  const servizio = clientServizio()

  const perTabella = new Map<TabellaTracciabile, string[]>()
  for (const { tabella, id } of elenco) {
    const ids = perTabella.get(tabella)
    if (ids) ids.push(id)
    else perTabella.set(tabella, [id])
  }

  for (const tabella of ORDINE) {
    const ids = perTabella.get(tabella)
    if (!ids || ids.length === 0) continue

    if (tabella === 'utenti_auth') {
      for (const id of ids) {
        const { error } = await servizio.auth.admin.deleteUser(id)
        // 404: l'utente può essere già sparito (registrato due volte, oppure
        // rimosso da un conPulizia annidato). Ogni altro errore è reale.
        if (error && error.status !== 404) throw error
      }
      continue
    }

    const { error } = await db.from(tabella).delete().in('id', ids)
    if (error) throw error
  }

  // Una delete che non trova nulla riesce in silenzio: senza questa verifica,
  // un ordine sbagliato o una FK `restrict` inattesa lascerebbe righe in giro
  // e il fallimento comparirebbe in una suite successiva, che non le ha
  // create. Meglio rumoroso qui.
  const superstiti: string[] = []
  for (const [tabella, ids] of perTabella) {
    if (tabella === 'utenti_auth') continue
    const { data, error } = await db.from(tabella).select('id').in('id', ids)
    if (error) throw error
    if (data && data.length > 0) superstiti.push(`${tabella}: ${data.length}`)
  }
  if (superstiti.length > 0) {
    throw new Error(`pulisci(): righe non cancellate — ${superstiti.join(', ')}`)
  }
}

/** Rimuove tutto ciò che è stato tracciato finora. Idempotente. */
export async function pulisci(): Promise<void> {
  const elenco = registro
  registro = []
  await pulisciElenco(elenco)
}

/**
 * Esegue fn con un registro proprio e lo svuota comunque, anche se fn lancia.
 * Serve dove la pulizia deve avvenire prima della fine del file — un test che
 * verifica la pulizia stessa, o uno che ricrea righe con gli stessi valori
 * unici. Il registro esterno non viene toccato.
 */
export async function conPulizia<T>(fn: () => Promise<T>): Promise<T> {
  const esterno = registro
  registro = []
  try {
    return await fn()
  } finally {
    const interno = registro
    registro = esterno
    await pulisciElenco(interno)
  }
}

// Registrata all'import: una suite che dimentica l'afterAll lascerebbe righe
// committate nel database locale, che è condiviso da tutte le suite.
afterAll(async () => {
  await pulisci()
})

/** Crea un utente Auth reale e restituisce un client autenticato come lui. */
export async function clientPerRuolo(
  ruolo: 'admin' | 'dirigente' | 'allenatore',
  opzioni: { personaId?: string } = {},
): Promise<{ db: Db; userId: string; personaId: string | null }> {
  const servizio = clientServizio()
  const email = `${ruolo}-${randomUUID()}@test.local`
  const password = 'password-di-prova-123'

  const { data: creato, error } = await servizio.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  traccia('utenti_auth', creato.user.id)

  // Un allenatore senza persona collegata viola profili_allenatore_ha_persona,
  // e non risolverebbe comunque nessuna squadra: app.mie_squadre() parte da
  // profili.persona_id.
  let personaId = opzioni.personaId ?? null
  if (personaId === null && ruolo === 'allenatore') {
    personaId = await creaPersona({ nome: 'Mister', cognome: 'Prova', dataNascita: '1980-01-01' })
  }

  const { error: erroreProfilo } = await servizio
    .from('profili')
    .insert({ id: creato.user.id, ruolo, persona_id: personaId })
  if (erroreProfilo) throw erroreProfilo
  traccia('profili', creato.user.id)

  const db = createClient<Database>(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error: erroreAccesso } = await db.auth.signInWithPassword({ email, password })
  if (erroreAccesso) throw erroreAccesso

  return { db, userId: creato.user.id, personaId }
}

/**
 * Codice-stagione casuale nella forma YYYY-YY imposta da stagioni_codice_forma.
 * Non un valore fisso: le suite girano su un database condiviso con il seed, e
 * un '2026-27' costante collide con la riga seminata.
 */
export function codiceStagioneCasuale(): string {
  const cifre = randomUUID().replace(/-/g, '')
  const anno = parseInt(cifre.slice(0, 8), 16) % 10000
  const suffisso = parseInt(cifre.slice(8, 16), 16) % 100
  return `${String(anno).padStart(4, '0')}-${String(suffisso).padStart(2, '0')}`
}

export async function creaPersona(
  dati: {
    nome?: string
    cognome?: string
    dataNascita?: string
    codiceFiscale?: string | null
    attiva?: boolean
  } = {},
): Promise<string> {
  const { data, error } = await clientServizio()
    .from('persone')
    .insert({
      nome: dati.nome ?? 'Mario',
      cognome: dati.cognome ?? 'Rossi',
      data_nascita: dati.dataNascita ?? '2012-05-14',
      codice_fiscale: dati.codiceFiscale ?? null,
      attiva: dati.attiva ?? true,
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('persone', data.id)
}

export async function creaStagione(
  dati: {
    codice?: string
    stato?: 'aperta' | 'chiusa'
    dataInizio?: string
    dataFine?: string
  } = {},
): Promise<string> {
  const codice = dati.codice ?? codiceStagioneCasuale()
  const { data, error } = await clientServizio()
    .from('stagioni')
    .insert({
      codice,
      etichetta: etichettaDaCodice(codice),
      data_inizio: dati.dataInizio ?? '2026-09-01',
      data_fine: dati.dataFine ?? '2027-06-30',
      stato: dati.stato ?? 'aperta',
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('stagioni', data.id)
}

export async function creaSquadra(
  stagioneId: string,
  dati: { nome?: string; categoria?: string; annata?: number } = {},
): Promise<string> {
  const { data, error } = await clientServizio()
    .from('squadre')
    .insert({
      stagione_id: stagioneId,
      nome: dati.nome ?? `Squadra ${randomUUID().slice(0, 8)}`,
      categoria: dati.categoria ?? 'Pulcini',
      annata: dati.annata ?? 2015,
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('squadre', data.id)
}

export async function creaTesseramento(dati: {
  personaId: string
  stagioneId: string
  squadraId?: string | null
  numeroMaglia?: number | null
  visitaScadenza?: string | null
  visitaConsegnataIl?: string | null
}): Promise<string> {
  const { data, error } = await clientServizio()
    .from('tesseramenti')
    .insert({
      persona_id: dati.personaId,
      stagione_id: dati.stagioneId,
      squadra_id: dati.squadraId ?? null,
      numero_maglia: dati.numeroMaglia ?? null,
      visita_scadenza: dati.visitaScadenza ?? null,
      visita_consegnata_il: dati.visitaConsegnataIl ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('tesseramenti', data.id)
}

export async function creaSeduta(dati: {
  squadraId: string
  stagioneId: string
  data?: string
  oraInizio?: string | null
}): Promise<string> {
  const { data, error } = await clientServizio()
    .from('sedute_allenamento')
    .insert({
      squadra_id: dati.squadraId,
      stagione_id: dati.stagioneId,
      data: dati.data ?? '2026-10-01',
      ora_inizio: dati.oraInizio ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('sedute_allenamento', data.id)
}

/**
 * `squadra_id` si ricava dalla seduta, come deve fare anche il repository: la
 * colonna è denormalizzata e chiederla al chiamante è il modo di scriverci
 * dentro la squadra sbagliata.
 */
export async function creaPresenza(dati: {
  sedutaId: string
  tesseramentoId: string
  stato: Database['public']['Enums']['stato_presenza']
}): Promise<string> {
  const servizio = clientServizio()
  const { data: seduta, error: erroreSeduta } = await servizio
    .from('sedute_allenamento')
    .select('squadra_id')
    .eq('id', dati.sedutaId)
    .single()
  if (erroreSeduta) throw erroreSeduta

  const { data, error } = await servizio
    .from('presenze')
    .insert({
      seduta_id: dati.sedutaId,
      tesseramento_id: dati.tesseramentoId,
      squadra_id: seduta.squadra_id,
      stato: dati.stato,
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('presenze', data.id)
}

export async function creaIncarico(dati: {
  personaId: string
  stagioneId: string
  squadraId: string
  ruolo?: 'allenatore' | 'vice_allenatore' | 'dirigente_squadra'
}): Promise<string> {
  const { data, error } = await clientServizio()
    .from('incarichi_staff')
    .insert({
      persona_id: dati.personaId,
      stagione_id: dati.stagioneId,
      squadra_id: dati.squadraId,
      ruolo: dati.ruolo ?? 'allenatore',
    })
    .select('id')
    .single()
  if (error) throw error
  return traccia('incarichi_staff', data.id)
}
