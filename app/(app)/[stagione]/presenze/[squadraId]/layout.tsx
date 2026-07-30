import { notFound } from 'next/navigation'
import { stagioneRichiesta } from '../../dati'
import { caricaSquadra } from '../../squadre/[squadraId]/dati'

/** 404 nel layout, e nessun `loading.tsx` fra qui e la radice. */
export default async function LayoutPresenzeSquadra({
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
