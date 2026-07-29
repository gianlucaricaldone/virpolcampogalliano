import { redirect } from 'next/navigation'
import { getSessione } from '@/lib/auth/session'
import { stagioneCorrente } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Punto di ingresso del backoffice. Non può stare in `(app)/page.tsx`:
 * risolverebbe a `/` come `(public)/page.tsx` e Next rifiuta due pagine
 * parallele sullo stesso percorso.
 *
 * Senza stagione aperta (database vuoto o tutte chiuse) NON si usa più
 * notFound(): il login porta sempre qui, quindi un 404 fuori dallo shell del
 * backoffice, senza nemmeno un link verso /admin/stagioni, sarebbe la prima
 * schermata vista da un admin dopo l'accesso — proprio nel momento in cui
 * dovrebbe poter creare una stagione.
 */
export default async function IngressoBackoffice() {
  const db = await supabaseServer()
  const corrente = await stagioneCorrente(db)
  if (corrente) redirect(`/${corrente.codice}`)

  const sessione = await getSessione(db)
  if (sessione?.ruolo === 'admin') redirect('/admin/stagioni')

  return (
    <p className="rounded border bg-white p-4 text-neutral-600">
      Nessuna stagione aperta al momento: contatta un amministratore.
    </p>
  )
}
