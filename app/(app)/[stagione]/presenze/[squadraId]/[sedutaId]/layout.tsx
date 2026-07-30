import { notFound } from 'next/navigation'
import { caricaFoglio } from './dati'

/**
 * 404 nel layout. Il controllo non è solo sull'esistenza della seduta: deve
 * essere della squadra nell'URL, altrimenti il foglio di una squadra
 * comparirebbe sotto il percorso di un'altra.
 *
 * Per un allenatore la seduta di un'altra squadra non è visibile affatto: le
 * RLS la nascondono, `caricaFoglio` torna null e il 404 è la risposta giusta —
 * dirgli "non autorizzato" gli confermerebbe che quella seduta esiste.
 */
export default async function LayoutFoglio({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ squadraId: string; sedutaId: string }>
}) {
  const { squadraId, sedutaId } = await params
  const foglio = await caricaFoglio(sedutaId)
  if (!foglio || foglio.seduta.squadraId !== squadraId) notFound()
  return children
}
