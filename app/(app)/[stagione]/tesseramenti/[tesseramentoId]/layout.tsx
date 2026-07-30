import { notFound } from 'next/navigation'
import { stagioneRichiesta } from '../../dati'
import { caricaTesserato } from './dati'

/**
 * 404 nel layout, e nessun `loading.tsx` fra qui e la radice: con un confine
 * Suspense sopra, lo status sarebbe già 200 quando il controllo gira (vedi
 * `(cruscotto)/loading.tsx`).
 *
 * Il tesseramento deve appartenere alla stagione dell'URL, altrimenti il
 * selettore mostrerebbe la scheda di una stagione diversa da quella scelta.
 */
export default async function LayoutTesseramento({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ stagione: string; tesseramentoId: string }>
}) {
  const { stagione: codice, tesseramentoId } = await params
  const stagione = await stagioneRichiesta(codice)
  const tesserato = await caricaTesserato(tesseramentoId)
  if (!tesserato || tesserato.stagioneId !== stagione.id) notFound()
  return children
}
