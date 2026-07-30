import type { SupabaseClient } from '@supabase/supabase-js'
import { ErroreDominio } from '@/lib/azioni'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type StatoPresenza = Database['public']['Enums']['stato_presenza']

// STATI_PRESENZA sta in `lib/costanti.ts`: lo legge il foglio presenze, che è
// un componente client, e da qui si porterebbe dietro `lib/azioni` e tutto ciò
// che ne consegue.

export type Seduta = {
  id: string
  squadraId: string
  stagioneId: string
  data: string
  oraInizio: string | null
  note: string | null
  registrate: number
}

export type RigaPresenza = {
  tesseramentoId: string
  numeroMaglia: number | null
  cognome: string
  nome: string
  stato: StatoPresenza | null
}

const CAMPI_SEDUTA = `
  id, squadra_id, stagione_id, data, ora_inizio, note,
  presenze:presenze!presenze_seduta_di_squadra (count)
`

type RigaSeduta = {
  id: string
  squadra_id: string
  stagione_id: string
  data: string
  ora_inizio: string | null
  note: string | null
  presenze: { count: number }[]
}

function daRigaSeduta(r: RigaSeduta): Seduta {
  return {
    id: r.id,
    squadraId: r.squadra_id,
    stagioneId: r.stagione_id,
    data: r.data,
    oraInizio: r.ora_inizio,
    note: r.note,
    registrate: r.presenze[0]?.count ?? 0,
  }
}

export async function elencaSedute(db: Db, squadraId: string): Promise<Seduta[]> {
  const { data, error } = await db
    .from('sedute_allenamento')
    .select(CAMPI_SEDUTA)
    .eq('squadra_id', squadraId)
    .order('data', { ascending: false })
    .order('ora_inizio', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data.map(daRigaSeduta)
}

export async function sedutaPerId(db: Db, id: string): Promise<Seduta | null> {
  const { data, error } = await db
    .from('sedute_allenamento').select(CAMPI_SEDUTA).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? daRigaSeduta(data) : null
}

export async function creaSeduta(
  db: Db,
  dati: {
    squadraId: string
    stagioneId: string
    data: string
    oraInizio?: string | null
    note?: string | null
    creataDa?: string | null
  },
): Promise<Seduta> {
  const { data, error } = await db
    .from('sedute_allenamento')
    .insert({
      squadra_id: dati.squadraId,
      stagione_id: dati.stagioneId,
      data: dati.data,
      ora_inizio: dati.oraInizio ?? null,
      note: dati.note ?? null,
      created_by: dati.creataDa ?? null,
    })
    .select(CAMPI_SEDUTA)
    .single()
  if (error) throw error
  return daRigaSeduta(data)
}

export async function rimuoviSeduta(db: Db, id: string): Promise<void> {
  const { error } = await db.from('sedute_allenamento').delete().eq('id', id)
  if (error) throw error
}

const CAMPI_FOGLIO = `
  id, squadra_id, stagione_id, data, ora_inizio, note,
  squadra:squadre!sedute_squadra_di_stagione (
    id, nome,
    rosa:tesseramenti!tesseramenti_squadra_di_stagione (
      id, numero_maglia,
      persona:persone!tesseramenti_persona_id_fkey (cognome, nome)
    )
  ),
  presenze:presenze!presenze_seduta_di_squadra (tesseramento_id, stato)
`

export type Foglio = {
  seduta: { id: string; squadraId: string; stagioneId: string; data: string; oraInizio: string | null; note: string | null }
  squadra: { id: string; nome: string }
  righe: RigaPresenza[]
}

/**
 * Seduta, rosa intera e presenze già registrate in **una** richiesta.
 *
 * La rosa arriva tutta, anche chi non ha ancora una riga di presenza: quel
 * caso ha stato nullo, ed è diverso da "assente". Confonderli è ciò che rende
 * le percentuali del sistema vecchio inattendibili.
 */
export async function getFoglio(db: Db, sedutaId: string): Promise<Foglio | null> {
  const { data, error } = await db
    .from('sedute_allenamento').select(CAMPI_FOGLIO).eq('id', sedutaId).maybeSingle()
  if (error) throw error
  if (!data) return null

  const perTesseramento = new Map(data.presenze.map((p) => [p.tesseramento_id, p.stato]))

  return {
    seduta: {
      id: data.id,
      squadraId: data.squadra_id,
      stagioneId: data.stagione_id,
      data: data.data,
      oraInizio: data.ora_inizio,
      note: data.note,
    },
    squadra: { id: data.squadra.id, nome: data.squadra.nome },
    righe: data.squadra.rosa
      .map((t) => ({
        tesseramentoId: t.id,
        numeroMaglia: t.numero_maglia,
        cognome: t.persona.cognome,
        nome: t.persona.nome,
        stato: perTesseramento.get(t.id) ?? null,
      }))
      .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')),
  }
}

/**
 * Tutte le righe del foglio in un upsert solo, più una delete per quelle
 * riportate a "non compilato".
 *
 * Venti giocatori sono un upsert di venti righe su UNIQUE (seduta_id,
 * tesseramento_id), non venti chiamate: con venti richieste HTTP la metà
 * riuscirebbe e la metà no, e il foglio resterebbe a metà senza che nessuno
 * sappia quale metà.
 *
 * `squadra_id` si ricava dalla seduta e non si chiede al chiamante: la colonna
 * è denormalizzata e NOT NULL, e passarla da fuori è il modo di scriverci
 * dentro la squadra sbagliata.
 */
export async function salvaPresenze(
  db: Db,
  sedutaId: string,
  righe: { tesseramentoId: string; stato: StatoPresenza | null }[],
): Promise<void> {
  if (righe.length === 0) return

  const { data: seduta, error: erroreSeduta } = await db
    .from('sedute_allenamento').select('squadra_id').eq('id', sedutaId).maybeSingle()
  if (erroreSeduta) throw erroreSeduta
  // Nessuna riga: o la seduta non esiste, o le RLS non la mostrano a chi
  // chiede. In entrambi i casi non c'è nulla da scrivere, e proseguire
  // significherebbe inventare uno squadra_id.
  if (!seduta) throw new ErroreDominio('Seduta non trovata o non accessibile')

  const daScrivere = righe.filter((r) => r.stato !== null)
  const daCancellare = righe.filter((r) => r.stato === null).map((r) => r.tesseramentoId)

  if (daScrivere.length > 0) {
    const { error } = await db.from('presenze').upsert(
      daScrivere.map((r) => ({
        seduta_id: sedutaId,
        tesseramento_id: r.tesseramentoId,
        squadra_id: seduta.squadra_id,
        stato: r.stato!,
      })),
      { onConflict: 'seduta_id,tesseramento_id' },
    )
    if (error) throw error
  }

  if (daCancellare.length > 0) {
    const { error } = await db
      .from('presenze')
      .delete()
      .eq('seduta_id', sedutaId)
      .in('tesseramento_id', daCancellare)
    if (error) throw error
  }
}
