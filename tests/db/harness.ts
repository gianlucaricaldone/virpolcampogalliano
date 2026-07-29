import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { etichettaDaCodice } from '@/lib/domain/stagione'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * Esegue fn in una transazione con ROLLBACK garantito: ogni test parte da
 * un database pulito senza dover troncare le tabelle.
 */
export async function inRollback<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DB_URL })
  await c.connect()
  try {
    await c.query('begin')
    return await fn(c)
  } finally {
    await c.query('rollback').catch(() => {})
    await c.end()
  }
}

/**
 * Esegue fn impersonando un utente applicativo: le RLS si attivano perché
 * `authenticated` non è superuser, e auth.uid() legge request.jwt.claims.
 */
export async function asUser<T>(c: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await c.query('set local role authenticated')
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  try {
    return await fn()
  } finally {
    await c.query('set local role postgres')
    await c.query(`select set_config('request.jwt.claims', null, true)`)
  }
}

/** Come asUser, ma senza sessione: è il caso del sito pubblico. */
export async function asAnon<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query('set local role anon')
  try {
    return await fn()
  } finally {
    await c.query('set local role postgres')
  }
}

/**
 * Crea una riga in auth.users e il profilo collegato, restituendo l'id.
 * Inserisce direttamente perché i test girano sul Postgres locale come
 * superuser: non serve passare dall'API di Auth.
 */
export async function creaUtenteAuth(
  c: Client,
  opzioni: { ruolo: 'admin' | 'dirigente' | 'allenatore'; personaId?: string },
): Promise<string> {
  const id = randomUUID()
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                             email_confirmed_at, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', $2, '', now(), now(), now())`,
    [id, `${id}@test.local`],
  )
  await c.query(`insert into public.profili (id, persona_id, ruolo) values ($1, $2, $3)`, [
    id,
    opzioni.personaId ?? null,
    opzioni.ruolo,
  ])
  return id
}

/** Inserisce una persona e ne restituisce l'id. */
export async function creaPersona(
  c: Client,
  dati: { nome?: string; cognome?: string; dataNascita?: string; codiceFiscale?: string } = {},
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.persone (nome, cognome, data_nascita, codice_fiscale)
     values ($1, $2, $3, $4) returning id`,
    [
      dati.nome ?? 'Mario',
      dati.cognome ?? 'Rossi',
      dati.dataNascita ?? '2012-05-14',
      dati.codiceFiscale ?? null,
    ],
  )
  return rows[0].id as string
}

/** Inserisce una stagione e ne restituisce l'id. */
export async function creaStagione(
  c: Client,
  dati: { codice?: string; stato?: 'aperta' | 'chiusa'; dataInizio?: string; dataFine?: string } = {},
): Promise<string> {
  const codice = dati.codice ?? '2026-27'
  const { rows } = await c.query(
    `insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      codice,
      etichettaDaCodice(codice),
      dati.dataInizio ?? '2026-09-01',
      dati.dataFine ?? '2027-06-30',
      dati.stato ?? 'aperta',
    ],
  )
  return rows[0].id as string
}

/** Inserisce una squadra nella stagione data e ne restituisce l'id. */
export async function creaSquadra(
  c: Client,
  stagioneId: string,
  dati: { nome?: string; categoria?: string; annata?: number } = {},
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.squadre (stagione_id, nome, categoria, annata)
     values ($1, $2, $3, $4) returning id`,
    [stagioneId, dati.nome ?? 'Pulcini A', dati.categoria ?? 'Pulcini', dati.annata ?? 2015],
  )
  return rows[0].id as string
}

/** Inserisce un tesseramento e ne restituisce l'id. */
export async function creaTesseramento(
  c: Client,
  dati: {
    personaId: string
    stagioneId: string
    squadraId?: string | null
    numeroMaglia?: number | null
    visitaScadenza?: string | null
    visitaConsegnataIl?: string | null
  },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.tesseramenti
       (persona_id, stagione_id, squadra_id, numero_maglia, visita_consegnata_il, visita_scadenza)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      dati.personaId,
      dati.stagioneId,
      dati.squadraId ?? null,
      dati.numeroMaglia ?? null,
      dati.visitaConsegnataIl ?? null,
      dati.visitaScadenza ?? null,
    ],
  )
  return rows[0].id as string
}

/** Inserisce un incarico di staff e ne restituisce l'id. */
export async function creaIncarico(
  c: Client,
  dati: {
    personaId: string
    stagioneId: string
    squadraId: string
    ruolo?: 'allenatore' | 'vice_allenatore' | 'dirigente_squadra'
  },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.incarichi_staff (persona_id, stagione_id, squadra_id, ruolo)
     values ($1, $2, $3, $4) returning id`,
    [dati.personaId, dati.stagioneId, dati.squadraId, dati.ruolo ?? 'allenatore'],
  )
  return rows[0].id as string
}

/** Inserisce l'importo atteso a uno dei tre livelli (stagione, squadra, tesseramento). */
export async function impostaQuota(
  c: Client,
  dati: { stagioneId?: string; squadraId?: string; tesseramentoId?: string; importo: number },
): Promise<void> {
  await c.query(
    `insert into public.quote_importi (stagione_id, squadra_id, tesseramento_id, importo)
     values ($1, $2, $3, $4)`,
    [dati.stagioneId ?? null, dati.squadraId ?? null, dati.tesseramentoId ?? null, dati.importo],
  )
}

/** Registra un versamento per un tesseramento. */
export async function registraPagamento(
  c: Client,
  tesseramentoId: string,
  importo: number,
  data = '2026-09-15',
): Promise<void> {
  await c.query(
    `insert into public.pagamenti_quota (tesseramento_id, importo, data)
     values ($1, $2, $3)`,
    [tesseramentoId, importo, data],
  )
}

/** Legge lo stato della quota da v_quote per un tesseramento. */
export async function leggiQuota(c: Client, tesseramentoId: string) {
  const { rows } = await c.query(
    `select quota_attesa::text, pagato::text, residuo::text, stato
     from public.v_quote where tesseramento_id = $1`,
    [tesseramentoId],
  )
  return rows[0] as { quota_attesa: string; pagato: string; residuo: string; stato: string }
}

/** Inserisce una seduta di allenamento e ne restituisce l'id. */
export async function creaSeduta(
  c: Client,
  dati: { squadraId: string; stagioneId: string; data?: string; oraInizio?: string | null },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.sedute_allenamento (squadra_id, stagione_id, data, ora_inizio)
     values ($1, $2, $3, $4) returning id`,
    [dati.squadraId, dati.stagioneId, dati.data ?? '2026-10-01', dati.oraInizio ?? null],
  )
  return rows[0].id as string
}

/**
 * Registra una presenza ricavando `squadra_id` dalla seduta, così i chiamanti
 * non devono conoscere la colonna denormalizzata. Per provare il rifiuto di
 * una squadra incoerente serve una insert scritta a mano, non questa.
 */
export async function registraPresenza(
  c: Client,
  sedutaId: string,
  tesseramentoId: string,
  stato: 'presente' | 'assente' | 'giustificato' | 'infortunato',
): Promise<void> {
  await c.query(
    `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
     select s.id, $2, s.squadra_id, $3
     from public.sedute_allenamento s where s.id = $1`,
    [sedutaId, tesseramentoId, stato],
  )
}

/** Legge le statistiche di presenza da v_presenze per un tesseramento. */
export async function leggiPresenze(c: Client, tesseramentoId: string) {
  const { rows } = await c.query(
    `select sedute_squadra, presenti, assenti, giustificati, infortuni,
            non_registrate, percentuale::text as percentuale
     from public.v_presenze where tesseramento_id = $1`,
    [tesseramentoId],
  )
  return rows[0] as {
    sedute_squadra: number; presenti: number; assenti: number; giustificati: number
    infortuni: number; non_registrate: number; percentuale: string | null
  }
}
