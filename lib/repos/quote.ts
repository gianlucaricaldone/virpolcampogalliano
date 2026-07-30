import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type StatoQuota = 'non_pagato' | 'parziale' | 'saldato'
export type LivelloImporto = 'tesseramento' | 'squadra' | 'stagione' | 'nessuno'
export type MetodoPagamento = Database['public']['Enums']['metodo_pagamento']

export type RigaQuota = {
  tesseramentoId: string
  quotaAttesa: number
  pagato: number
  residuo: number
  stato: StatoQuota
  livelloImporto: LivelloImporto
  persona: { id: string; cognome: string; nome: string }
  squadra: { id: string; nome: string } | null
}

export type Pagamento = {
  id: string
  importo: number
  data: string
  metodo: MetodoPagamento
  note: string | null
}

/** Livello a cui si configura un importo: esattamente uno dei tre. */
export type Livello =
  | { stagioneId: string; squadraId?: never; tesseramentoId?: never }
  | { squadraId: string; stagioneId?: never; tesseramentoId?: never }
  | { tesseramentoId: string; stagioneId?: never; squadraId?: never }

const CAMPI_QUOTA = `
  tesseramento_id, quota_attesa, pagato, residuo, stato, livello_importo,
  persona:persone!tesseramenti_persona_id_fkey (id, cognome, nome),
  squadra:squadre!tesseramenti_squadra_di_stagione (id, nome)
`

/**
 * Stato delle quote della stagione, **letto** da `v_quote`.
 *
 * Non esiste una copia TypeScript della regola: quota attesa, pagato, residuo
 * e stato arrivano dalla vista così come sono. Due implementazioni divergono,
 * e quando divergono l'elenco dice "parziale" mentre la scheda dice "saldato".
 */
export async function statoQuote(
  db: Db,
  stagioneId: string,
  filtro: { squadraId?: string; soloNonSaldate?: boolean } = {},
): Promise<RigaQuota[]> {
  let query = db.from('v_quote').select(CAMPI_QUOTA).eq('stagione_id', stagioneId)
  if (filtro.squadraId) query = query.eq('squadra_id', filtro.squadraId)
  if (filtro.soloNonSaldate) query = query.neq('stato', 'saldato')

  const { data, error } = await query
  if (error) throw error

  return data
    .map((r) => ({
      tesseramentoId: r.tesseramento_id!,
      quotaAttesa: Number(r.quota_attesa ?? 0),
      pagato: Number(r.pagato ?? 0),
      residuo: Number(r.residuo ?? 0),
      stato: (r.stato ?? 'saldato') as StatoQuota,
      livelloImporto: (r.livello_importo ?? 'nessuno') as LivelloImporto,
      persona: {
        id: r.persona!.id,
        cognome: r.persona!.cognome,
        nome: r.persona!.nome,
      },
      squadra: r.squadra ? { id: r.squadra.id, nome: r.squadra.nome } : null,
    }))
    .sort(
      (a, b) =>
        a.persona.cognome.localeCompare(b.persona.cognome, 'it') ||
        a.persona.nome.localeCompare(b.persona.nome, 'it'),
    )
}

/** La riga di `v_quote` di un singolo tesserato, per la sua scheda. */
export async function quotaPerTesseramento(
  db: Db,
  tesseramentoId: string,
): Promise<RigaQuota | null> {
  const { data, error } = await db
    .from('v_quote')
    .select(CAMPI_QUOTA)
    .eq('tesseramento_id', tesseramentoId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    tesseramentoId: data.tesseramento_id!,
    quotaAttesa: Number(data.quota_attesa ?? 0),
    pagato: Number(data.pagato ?? 0),
    residuo: Number(data.residuo ?? 0),
    stato: (data.stato ?? 'saldato') as StatoQuota,
    livelloImporto: (data.livello_importo ?? 'nessuno') as LivelloImporto,
    persona: {
      id: data.persona!.id,
      cognome: data.persona!.cognome,
      nome: data.persona!.nome,
    },
    squadra: data.squadra ? { id: data.squadra.id, nome: data.squadra.nome } : null,
  }
}

/**
 * Scrive l'importo atteso a uno dei tre livelli.
 *
 * È un upsert e non un insert: le tre colonne di livello sono UNIQUE, quindi
 * correggere una cifra già configurata darebbe "valore già presente" invece di
 * cambiarla.
 */
export async function impostaImporto(db: Db, livello: Livello, importo: number): Promise<void> {
  const riga = {
    stagione_id: livello.stagioneId ?? null,
    squadra_id: livello.squadraId ?? null,
    tesseramento_id: livello.tesseramentoId ?? null,
    importo,
  }
  const colonna = livello.stagioneId
    ? 'stagione_id'
    : livello.squadraId
      ? 'squadra_id'
      : 'tesseramento_id'

  const { error } = await db.from('quote_importi').upsert(riga, { onConflict: colonna })
  if (error) throw error
}

/** Toglie un override e fa tornare in vigore il livello superiore. Solo admin. */
export async function rimuoviImporto(db: Db, livello: Livello): Promise<void> {
  const query = db.from('quote_importi').delete()
  const { error } = livello.stagioneId
    ? await query.eq('stagione_id', livello.stagioneId)
    : livello.squadraId
      ? await query.eq('squadra_id', livello.squadraId)
      : await query.eq('tesseramento_id', livello.tesseramentoId!)
  if (error) throw error
}

export async function importoStagione(db: Db, stagioneId: string): Promise<number | null> {
  const { data, error } = await db
    .from('quote_importi').select('importo').eq('stagione_id', stagioneId).maybeSingle()
  if (error) throw error
  return data ? Number(data.importo) : null
}

export async function importiPerSquadra(
  db: Db,
  squadreIds: string[],
): Promise<Map<string, number>> {
  if (squadreIds.length === 0) return new Map()
  const { data, error } = await db
    .from('quote_importi').select('squadra_id, importo').in('squadra_id', squadreIds)
  if (error) throw error
  return new Map(data.map((r) => [r.squadra_id!, Number(r.importo)]))
}

export async function importoTesseramento(
  db: Db,
  tesseramentoId: string,
): Promise<number | null> {
  const { data, error } = await db
    .from('quote_importi').select('importo').eq('tesseramento_id', tesseramentoId).maybeSingle()
  if (error) throw error
  return data ? Number(data.importo) : null
}

/**
 * Un versamento è una riga nel registro, non una modifica di stato: "metà
 * quota" non è un caso speciale ma un importo pari a metà, e lo stato resta
 * un calcolo della vista sulla somma dei versamenti.
 */
export async function registraPagamento(
  db: Db,
  dati: {
    tesseramentoId: string
    importo: number
    data: string
    metodo?: MetodoPagamento
    note?: string | null
    registratoDa?: string | null
  },
): Promise<Pagamento> {
  const { data, error } = await db
    .from('pagamenti_quota')
    .insert({
      tesseramento_id: dati.tesseramentoId,
      importo: dati.importo,
      data: dati.data,
      metodo: dati.metodo ?? 'contanti',
      note: dati.note ?? null,
      registrato_da: dati.registratoDa ?? null,
    })
    .select('id, importo, data, metodo, note')
    .single()
  if (error) throw error
  return { ...data, importo: Number(data.importo) }
}

export async function elencaPagamenti(db: Db, tesseramentoId: string): Promise<Pagamento[]> {
  const { data, error } = await db
    .from('pagamenti_quota')
    .select('id, importo, data, metodo, note')
    .eq('tesseramento_id', tesseramentoId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((p) => ({ ...p, importo: Number(p.importo) }))
}

export async function annullaPagamento(db: Db, id: string): Promise<void> {
  const { error } = await db.from('pagamenti_quota').delete().eq('id', id)
  if (error) throw error
}
