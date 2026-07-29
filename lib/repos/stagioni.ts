import type { SupabaseClient } from '@supabase/supabase-js'
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
 * precedente non ancora chiusa, restituisce quella nuova.
 */
export async function stagioneCorrente(db: Db): Promise<Stagione | null> {
  const { data, error } = await db
    .from('stagioni').select(CAMPI)
    .eq('stato', 'aperta')
    .order('data_inizio', { ascending: false })
    .limit(1).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function stagionePerCodice(db: Db, codice: string): Promise<Stagione | null> {
  const { data, error } = await db.from('stagioni').select(CAMPI).eq('codice', codice).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}
