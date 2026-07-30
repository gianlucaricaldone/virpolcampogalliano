import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormSquadra } from '@/components/squadre/FormSquadra'
import { PulsanteEliminaSquadra } from '@/components/squadre/PulsanteEliminaSquadra'
import { getSessione } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import { aggiornaSquadraAzione } from '../actions'
import { caricaSquadra } from './dati'

export default async function PaginaSquadra({
  params,
}: {
  params: Promise<{ stagione: string; squadraId: string }>
}) {
  const { stagione: codice, squadraId } = await params
  const stagione = await stagioneRichiesta(codice)
  // Il layout ha già deciso il 404: qui la lettura arriva dalla cache di
  // richiesta e serve a restringere il tipo.
  const squadra = await caricaSquadra(squadraId)
  if (!squadra) notFound()

  const db = await supabaseServer()
  const sessione = await getSessione(db)
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{squadra.nome}</h1>
          <p className="text-sm text-neutral-600">
            {squadra.categoria}
            {squadra.annata ? ` · annata ${squadra.annata}` : ''}
          </p>
        </div>
        <Link href={`/${codice}/squadre`} className="text-sm underline">
          Torna alle squadre
        </Link>
      </div>

      {puoScrivere ? (
        <>
          <FormSquadra
            azione={aggiornaSquadraAzione.bind(null, codice, squadra.id)}
            squadra={squadra}
            etichettaInvio="Salva modifiche"
          />
          <PulsanteEliminaSquadra codiceStagione={codice} id={squadra.id} nome={squadra.nome} />
        </>
      ) : (
        <p className="rounded border bg-white p-4 text-neutral-600">
          {stagione.stato === 'chiusa'
            ? 'Stagione chiusa: la squadra è in sola lettura.'
            : 'Non hai i permessi per modificare questa squadra.'}
        </p>
      )}
    </section>
  )
}
