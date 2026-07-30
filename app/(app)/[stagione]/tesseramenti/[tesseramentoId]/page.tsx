import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloQuota } from '@/components/quote/PannelloQuota'
import { RigaImporto } from '@/components/quote/RigaImporto'
import { PannelloAssegnazione } from '@/components/tesseramenti/PannelloAssegnazione'
import { getSessione } from '@/lib/auth/session'
import {
  elencaPagamenti,
  importoTesseramento,
  quotaPerTesseramento,
} from '@/lib/repos/quote'
import { PannelloVisita } from '@/components/visite/PannelloVisita'
import { elencaSquadre } from '@/lib/repos/squadre'
import { visitaPerTesseramento } from '@/lib/repos/visite'
import { supabaseServer } from '@/lib/supabase/server'
import {
  annullaPagamentoAzione,
  impostaImportoAzione,
  registraPagamentoAzione,
  rimuoviImportoAzione,
} from '../../quote/actions'
import { stagioneRichiesta } from '../../dati'
import {
  aggiornaAssegnazioneAzione,
  impostaVisitaAzione,
  rimuoviTesseramentoAzione,
} from '../actions'
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
  const staff = sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente'
  const puoScrivere = staff && stagione.stato === 'aperta'
  const squadre = puoScrivere ? await elencaSquadre(db, stagione.id) : []

  // L'allenatore non vede nulla di finanziario: non gli si chiede il dato,
  // invece di chiederlo e nasconderlo.
  const quota = staff ? await quotaPerTesseramento(db, tesseramentoId) : null
  const pagamenti = staff ? await elencaPagamenti(db, tesseramentoId) : []
  const override = staff ? await importoTesseramento(db, tesseramentoId) : null
  const oggi = new Date().toISOString().slice(0, 10)
  // La visita la vede anche l'allenatore: è il dato che gli dice chi può
  // scendere in campo, e le sue policy su tesseramenti glielo consentono.
  const visita = await visitaPerTesseramento(db, tesseramentoId)

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

      {visita && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Visita medica</h2>
          <PannelloVisita
            visita={visita}
            azione={impostaVisitaAzione.bind(null, codice, tesseramentoId)}
            modificabile={puoScrivere}
          />
        </div>
      )}

      {staff && quota && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quota di iscrizione</h2>
          <div className="rounded border bg-white">
            <RigaImporto
              etichetta="Importo personale"
              valore={override}
              ereditato={
                override === null && quota.quotaAttesa > 0
                  ? { importo: quota.quotaAttesa, da: quota.livelloImporto }
                  : null
              }
              azione={impostaImportoAzione.bind(null, codice, { tesseramentoId })}
              rimuovi={
                sessione?.ruolo === 'admin' && puoScrivere
                  ? rimuoviImportoAzione.bind(null, codice, { tesseramentoId })
                  : undefined
              }
              modificabile={puoScrivere}
            />
          </div>
          <PannelloQuota
            quota={quota}
            pagamenti={pagamenti}
            registra={registraPagamentoAzione.bind(null, codice, tesseramentoId)}
            annulla={annullaPagamentoAzione.bind(null, codice, tesseramentoId)}
            oggi={oggi}
            modificabile={puoScrivere}
          />
        </div>
      )}
    </section>
  )
}
