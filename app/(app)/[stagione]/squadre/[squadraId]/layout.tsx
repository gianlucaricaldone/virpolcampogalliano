import { notFound } from 'next/navigation'
import { stagioneRichiesta } from '../../dati'
import { caricaSquadra } from './dati'

/**
 * Il 404 sta nel layout del segmento, non nella pagina: sotto un confine
 * Suspense la risposta ha già iniziato a fluire con status 200 e un
 * `notFound()` produrrebbe una pagina vuota "riuscita".
 *
 * Il controllo non è solo sull'esistenza: una squadra della 2026-27 aperta con
 * il codice della 2025-26 nell'URL non è la squadra di quella stagione, ed è
 * un 404 — altrimenti il selettore di stagione mostrerebbe un contenuto che
 * non appartiene alla stagione selezionata.
 */
export default async function LayoutSquadra({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ stagione: string; squadraId: string }>
}) {
  const { stagione: codice, squadraId } = await params
  const stagione = await stagioneRichiesta(codice)
  const squadra = await caricaSquadra(squadraId)
  if (!squadra || squadra.stagioneId !== stagione.id) notFound()
  return children
}
