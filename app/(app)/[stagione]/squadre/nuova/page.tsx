import { redirect } from 'next/navigation'
import { FormSquadra } from '@/components/squadre/FormSquadra'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { stagioneRichiesta } from '../../dati'
import { creaSquadraAzione } from '../actions'

export default async function PaginaNuovaSquadra({
  params,
}: {
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  const stagione = await stagioneRichiesta(codice)

  const sessione = await sessioneCorrente()
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'
  if (!puoScrivere) redirect(`/${codice}/squadre`)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Nuova squadra — {stagione.etichetta}</h1>
      <FormSquadra
        azione={creaSquadraAzione.bind(null, codice)}
        etichettaInvio="Crea squadra"
      />
    </section>
  )
}
