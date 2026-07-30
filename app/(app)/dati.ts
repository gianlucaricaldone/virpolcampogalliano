import { cache } from 'react'
import { elencaStagioni, type Stagione } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * L'elenco delle stagioni, una volta per richiesta.
 *
 * Lo chiedono due layout annidati — `(app)/layout.tsx` per la barra di
 * navigazione e `[stagione]/layout.tsx` per il selettore — quindi senza cache
 * ogni pagina del backoffice faceva la stessa query due volte.
 */
export const caricaStagioni = cache(async (): Promise<Stagione[]> => {
  return elencaStagioni(await supabaseServer())
})
