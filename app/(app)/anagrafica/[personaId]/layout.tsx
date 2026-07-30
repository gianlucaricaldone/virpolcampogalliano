import { notFound } from 'next/navigation'
import { caricaPersona } from './dati'

/**
 * Il 404 vive qui e non nella pagina. Un `notFound()` chiamato sotto un
 * confine Suspense arriva quando la risposta ha già iniziato a fluire e lo
 * status è impegnato a 200: la pagina risulta vuota ma "riuscita", e un
 * monitor o una regola di retry lato client non se ne accorgono. Nel layout
 * del segmento il controllo gira prima che lo shell venga inviato.
 */
export default async function LayoutPersona({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ personaId: string }>
}) {
  const { personaId } = await params
  if (!(await caricaPersona(personaId))) notFound()
  return children
}
