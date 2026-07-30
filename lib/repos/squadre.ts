import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type Squadra = {
  id: string
  stagioneId: string
  nome: string
  categoria: string
  annata: number | null
  note: string | null
}

export type DatiSquadra = {
  nome: string
  categoria: string
  annata?: number | null
  note?: string | null
}

const CAMPI = 'id, stagione_id, nome, categoria, annata, note'

type Riga = Pick<
  Database['public']['Tables']['squadre']['Row'],
  'id' | 'stagione_id' | 'nome' | 'categoria' | 'annata' | 'note'
>

function daRiga(r: Riga): Squadra {
  return {
    id: r.id,
    stagioneId: r.stagione_id,
    nome: r.nome,
    categoria: r.categoria,
    annata: r.annata,
    note: r.note,
  }
}

function aRiga(dati: Partial<DatiSquadra>): Database['public']['Tables']['squadre']['Update'] {
  const riga: Database['public']['Tables']['squadre']['Update'] = {}
  if (dati.nome !== undefined) riga.nome = dati.nome
  if (dati.categoria !== undefined) riga.categoria = dati.categoria
  if (dati.annata !== undefined) riga.annata = dati.annata
  if (dati.note !== undefined) riga.note = dati.note
  return riga
}

/**
 * La stagione arriva sempre da fuori — dal segmento di rotta — e mai da
 * `stagioneCorrente`: una pagina aperta sulla 2025-26 deve mostrare le squadre
 * della 2025-26 anche a stagione nuova già aperta.
 */
export async function elencaSquadre(db: Db, stagioneId: string): Promise<Squadra[]> {
  const { data, error } = await db
    .from('squadre')
    .select(CAMPI)
    .eq('stagione_id', stagioneId)
    .order('categoria')
    .order('nome')
  if (error) throw error
  return data.map(daRiga)
}

export async function squadraPerId(db: Db, id: string): Promise<Squadra | null> {
  const { data, error } = await db.from('squadre').select(CAMPI).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function creaSquadra(
  db: Db,
  dati: DatiSquadra & { stagioneId: string },
): Promise<Squadra> {
  const { data, error } = await db
    .from('squadre')
    .insert({
      ...aRiga(dati),
      stagione_id: dati.stagioneId,
      nome: dati.nome,
      categoria: dati.categoria,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return daRiga(data)
}

export async function aggiornaSquadra(
  db: Db,
  id: string,
  dati: Partial<DatiSquadra>,
): Promise<void> {
  const { error } = await db.from('squadre').update(aRiga(dati)).eq('id', id)
  if (error) throw error
}

/**
 * Cancella la squadra e, per cascade, le sue sedute, le presenze raccolte e
 * gli incarichi di staff; i tesseramenti restano nella stagione con
 * `squadra_id` a null. Non è reversibile: l'interfaccia deve dirlo prima.
 */
export async function eliminaSquadra(db: Db, id: string): Promise<void> {
  const { error } = await db.from('squadre').delete().eq('id', id)
  if (error) throw error
}
