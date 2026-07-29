import { notFound, redirect } from 'next/navigation'
import { stagioneCorrente } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Punto di ingresso del backoffice. Non può stare in `(app)/page.tsx`:
 * risolverebbe a `/` come `(public)/page.tsx` e Next rifiuta due pagine
 * parallele sullo stesso percorso.
 */
export default async function IngressoBackoffice() {
  const db = await supabaseServer()
  const corrente = await stagioneCorrente(db)
  if (!corrente) notFound()
  redirect(`/${corrente.codice}`)
}
