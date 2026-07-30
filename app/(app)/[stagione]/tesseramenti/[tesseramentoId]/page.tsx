import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloAssegnazione } from '@/components/tesseramenti/PannelloAssegnazione'
import { getSessione } from '@/lib/auth/session'
import { elencaSquadre } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import { aggiornaAssegnazioneAzione, rimuoviTesseramentoAzione } from '../actions'
import { caricaTesserato } from './dati'

export default async function PaginaTesseramento({
  params,
}: {
  params: Promise<{ stagione: string; tesseramentoId: string }>
}) {
  const { stagione: codice, tesseramentoId } = await params
  const stagione = await stagioneRichiesta(codice)
  // Il layout ha già deciso il 404: qui si legge dalla cache di richiesta.
  const tesserato = await caricaTesserato(tesseramentoId)
  if (!tesserato) notFound()

  const db = await supabaseServer()
  const sessione = await getSessione(db)
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'
  const squadre = puoScrivere ? await elencaSquadre(db, stagione.id) : []

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {tesserato.persona.cognome} {tesserato.persona.nome}
          </h1>
          <p className="text-sm text-neutral-600">
            {stagione.etichetta} · nato il {tesserato.persona.dataNascita}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/anagrafica/${tesserato.persona.id}`} className="underline">
            Scheda anagrafica
          </Link>
          <Link href={`/${codice}/tesseramenti`} className="underline">
            Torna ai tesserati
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Squadra e maglia</h2>
        {puoScrivere ? (
          <PannelloAssegnazione
            azione={aggiornaAssegnazioneAzione.bind(null, codice, tesserato.id)}
            rimuovi={rimuoviTesseramentoAzione.bind(null, codice, tesserato.id)}
            tesserato={tesserato}
            squadre={squadre}
          />
        ) : (
          <p className="rounded border bg-white p-4 text-sm text-neutral-600">
            {tesserato.squadra ? tesserato.squadra.nome : 'Senza squadra'}
            {tesserato.numeroMaglia ? ` · maglia ${tesserato.numeroMaglia}` : ''}
            {stagione.stato === 'chiusa' && ' — stagione chiusa, sola lettura.'}
          </p>
        )}
      </div>
    </section>
  )
}
