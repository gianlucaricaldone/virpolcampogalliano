import { redirect } from 'next/navigation'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { stagioneCorrenteDa } from '@/lib/domain/stagione'
import { caricaStagioni } from '../dati'

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
  // `caricaStagioni` l'ha già chiesta il layout: la regola della stagione
  // corrente si applica a quell'elenco invece di rifare la query. Resta
  // l'unica implementazione, `stagioneCorrenteDa`.
  const [stagioni, sessione] = await Promise.all([caricaStagioni(), sessioneCorrente()])
  const corrente = stagioneCorrenteDa(stagioni)
  if (corrente) redirect(`/${corrente.codice}`)

  if (sessione?.ruolo === 'admin') redirect('/admin/stagioni')

  return (
    <p className="rounded-lg border bg-white p-4 text-neutral-600">
      Nessuna stagione aperta al momento: contatta un amministratore.
    </p>
  )
}
