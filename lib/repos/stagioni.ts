import type { SupabaseClient } from '@supabase/supabase-js'
import { stagioneCorrenteDa } from '@/lib/domain/stagione'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>
type Riga = Database['public']['Tables']['stagioni']['Row']

export type Stagione = {
  id: string
  codice: string
  etichetta: string
  dataInizio: string
  dataFine: string
  stato: 'aperta' | 'chiusa'
}

const CAMPI = 'id, codice, etichetta, data_inizio, data_fine, stato'

function daRiga(r: Pick<Riga, 'id' | 'codice' | 'etichetta' | 'data_inizio' | 'data_fine' | 'stato'>): Stagione {
  return {
    id: r.id,
    codice: r.codice,
    etichetta: r.etichetta,
    dataInizio: r.data_inizio,
    dataFine: r.data_fine,
    stato: r.stato,
  }
}

export async function elencaStagioni(db: Db): Promise<Stagione[]> {
  const { data, error } = await db.from('stagioni').select(CAMPI).order('data_inizio', { ascending: false })
  if (error) throw error
  return data.map(daRiga)
}

/**
 * Stagione corrente: la prima aperta ordinata per data di inizio decrescente.
 * Derivata e non memorizzata — a luglio, con la stagione nuova già aperta e la
 * precedente non ancora chiusa, restituisce quella nuova. La regola vive in
 * un'unica funzione pura (lib/domain/stagione.ts), condivisa con NavBackoffice:
 * niente di ordina-e-filtra duplicato qui.
 */
export async function stagioneCorrente(db: Db): Promise<Stagione | null> {
  return stagioneCorrenteDa(await elencaStagioni(db))
}

export async function stagionePerCodice(db: Db, codice: string): Promise<Stagione | null> {
  const { data, error } = await db.from('stagioni').select(CAMPI).eq('codice', codice).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function creaStagione(
  db: Db,
  dati: { codice: string; etichetta: string; dataInizio: string; dataFine: string },
): Promise<Stagione> {
  const { data, error } = await db
    .from('stagioni')
    .insert({
      codice: dati.codice,
      etichetta: dati.etichetta,
      data_inizio: dati.dataInizio,
      data_fine: dati.dataFine,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return daRiga(data)
}

export async function cambiaStato(
  db: Db,
  id: string,
  stato: 'aperta' | 'chiusa',
): Promise<void> {
  const { error } = await db.from('stagioni').update({ stato }).eq('id', id)
  if (error) throw error
}
