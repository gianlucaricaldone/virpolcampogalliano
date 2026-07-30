import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DettagliPersona } from '@/components/persone/DettagliPersona'
import { FormPersona } from '@/components/persone/FormPersona'
import { PulsanteArchiviazione } from '@/components/persone/PulsanteArchiviazione'
import { StoricoPersona } from '@/components/persone/StoricoPersona'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { storicoPersona } from '@/lib/repos/persone'
import { supabaseServer } from '@/lib/supabase/server'
import { aggiornaPersonaAzione } from '../actions'
import { caricaPersona } from './dati'

export default async function PaginaPersona({
  params,
}: {
  params: Promise<{ personaId: string }>
}) {
  const { personaId } = await params
  // Il layout ha già deciso il 404: qui la rilettura viene dalla cache di
  // richiesta e serve solo a restringere il tipo.
  // Lo storico non dipende dalla persona: gli basta l'id, che è nell'URL.
  const db = await supabaseServer()
  const [persona, sessione, storico] = await Promise.all([
    caricaPersona(personaId),
    sessioneCorrente(),
    storicoPersona(db, personaId),
  ])
  if (!persona) notFound()

  const puoScrivere = sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {persona.cognome} {persona.nome}
          </h1>
          {!persona.attiva && (
            <p className="mt-1 inline-block rounded bg-neutral-200 px-2 py-0.5 text-sm text-neutral-700">
              Archiviata
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/anagrafica" className="text-sm underline">Torna all&apos;anagrafica</Link>
          {puoScrivere && <PulsanteArchiviazione id={persona.id} attiva={persona.attiva} />}
        </div>
      </div>

      {puoScrivere ? (
        <FormPersona
          azione={aggiornaPersonaAzione.bind(null, persona.id)}
          persona={persona}
          etichettaInvio="Salva modifiche"
        />
      ) : (
        <DettagliPersona persona={persona} />
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Storico</h2>
        <StoricoPersona storico={storico} />
      </div>
    </section>
  )
}
