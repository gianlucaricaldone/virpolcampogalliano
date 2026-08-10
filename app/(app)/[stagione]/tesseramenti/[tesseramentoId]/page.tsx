import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloMateriale } from '@/components/materiale/PannelloMateriale'
import { SezioneQuota } from '@/components/quote/SezioneQuota'
import { PannelloAssegnazione } from '@/components/tesseramenti/PannelloAssegnazione'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { formattaData } from '@/lib/domain/data'
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
  impostaMaterialeAzione,
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
  // Layout e pagina condividono queste tre letture attraverso React.cache:
  // qui sono già risolte.
  const [stagione, tesserato, db, sessione] = await Promise.all([
    stagioneRichiesta(codice),
    caricaTesserato(tesseramentoId),
    supabaseServer(),
    sessioneCorrente(),
  ])
  if (!tesserato) notFound()

  const staff = sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente'
  const puoScrivere = staff && stagione.stato === 'aperta'
  const oggi = new Date().toISOString().slice(0, 10)

  // Cinque letture indipendenti fra loro: in serie erano cinque round trip in
  // fila, e su Vercel con il database in un'altra region è il costo dominante
  // di questa pagina. L'allenatore non vede nulla di finanziario, e i dati
  // finanziari non gli vengono chiesti — non chiesti e poi nascosti.
  const [squadre, quota, pagamenti, override, visita] = await Promise.all([
    puoScrivere ? elencaSquadre(db, stagione.id) : [],
    staff ? quotaPerTesseramento(db, tesseramentoId) : null,
    staff ? elencaPagamenti(db, tesseramentoId) : [],
    staff ? importoTesseramento(db, tesseramentoId) : null,
    // La visita la vede anche l'allenatore: è il dato che gli dice chi può
    // scendere in campo, e le sue policy su tesseramenti glielo consentono.
    visitaPerTesseramento(db, tesseramentoId),
  ])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {tesserato.persona.cognome} {tesserato.persona.nome}
          </h1>
          <p className="text-sm text-neutral-600">
            {stagione.etichetta}
            {tesserato.persona.dataNascita && ` · nato il ${formattaData(tesserato.persona.dataNascita)}`}
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
          <p className="rounded-lg border bg-white p-4 text-sm text-neutral-600">
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

      {/* Fuori dal `staff &&`: il materiale non è un dato finanziario, e chi
          allena sapere se la sua squadra ha le divise gli serve. Non è nemmeno
          dentro un `visita &&` — quello dipende da una riga di `v_visite`, questo
          sono due colonne del tesseramento, che c'è sempre. */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Materiale sportivo</h2>
        <PannelloMateriale
          materiale={{
            consegnato: tesserato.materialeConsegnato,
            taglia: tesserato.materialeTaglia,
          }}
          azione={impostaMaterialeAzione.bind(null, codice, tesseramentoId)}
          modificabile={puoScrivere}
        />
      </div>

      {staff && quota && (
        <SezioneQuota
          quota={quota}
          pagamenti={pagamenti}
          override={override}
          impostaImporto={impostaImportoAzione.bind(null, codice, { tesseramentoId })}
          rimuoviImporto={
            sessione?.ruolo === 'admin' && puoScrivere
              ? rimuoviImportoAzione.bind(null, codice, { tesseramentoId })
              : undefined
          }
          registra={registraPagamentoAzione.bind(null, codice, tesseramentoId)}
          annulla={annullaPagamentoAzione.bind(null, codice, tesseramentoId)}
          oggi={oggi}
          modificabile={puoScrivere}
        />
      )}
    </section>
  )
}
