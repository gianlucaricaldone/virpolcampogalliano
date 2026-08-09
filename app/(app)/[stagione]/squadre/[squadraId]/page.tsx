import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloStaff } from '@/components/incarichi/PannelloStaff'
import { FormSquadra } from '@/components/squadre/FormSquadra'
import { PulsanteEliminaSquadra } from '@/components/squadre/PulsanteEliminaSquadra'
import { SezioneRosa } from '@/components/tesseramenti/SezioneRosa'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaIncarichi } from '@/lib/repos/incarichi'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import {
  aggiornaSquadraAzione,
  cercaCandidatiAzione,
  creaGiocatoreNellaSquadraAzione,
  creaIncaricoAzione,
  rimuoviIncaricoAzione,
  tesseraNellaSquadraAzione,
} from '../actions'
import { caricaSquadra } from './dati'

// Nessun searchParams: le due ricerche in anagrafica sono autocomplete che
// interrogano cercaCandidatiAzione mentre si scrive. Prima stavano nell'URL
// (`?rosa=`, `?staff=`) e ogni battuta di ricerca ricaricava la pagina intera.
export default async function PaginaSquadra({
  params,
}: {
  params: Promise<{ stagione: string; squadraId: string }>
}) {
  const { stagione: codice, squadraId } = await params
  // Il layout ha già risolto stagione e squadra: React.cache le restituisce
  // senza rifare le query.
  const [stagione, squadra, db, sessione] = await Promise.all([
    stagioneRichiesta(codice),
    caricaSquadra(squadraId),
    supabaseServer(),
    sessioneCorrente(),
  ])
  if (!squadra) notFound()

  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'

  // Due letture indipendenti, e nient'altro: i candidati per gli autocomplete
  // non si calcolano più qui.
  const [rosa, incarichi] = await Promise.all([
    elencaTesseramenti(db, stagione.id, { squadraId: squadra.id }),
    elencaIncarichi(db, squadra.id),
  ])

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

      <SezioneRosa
        rosa={rosa}
        codiceStagione={codice}
        cerca={cercaCandidatiAzione.bind(null, codice, squadra.id, 'rosa')}
        azione={tesseraNellaSquadraAzione.bind(null, codice, squadra.id)}
        azioneNuovo={creaGiocatoreNellaSquadraAzione.bind(null, codice, squadra.id)}
        modificabile={puoScrivere}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Staff</h2>
        <PannelloStaff
          incarichi={incarichi}
          cerca={cercaCandidatiAzione.bind(null, codice, squadra.id, 'staff')}
          aggiungi={creaIncaricoAzione.bind(null, codice, squadra.id)}
          rimuovi={rimuoviIncaricoAzione.bind(null, codice, squadra.id)}
          modificabile={puoScrivere}
        />
      </div>

      {puoScrivere ? (
        <div className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold">Dati della squadra</h2>
          <FormSquadra
            azione={aggiornaSquadraAzione.bind(null, codice, squadra.id)}
            squadra={squadra}
            etichettaInvio="Salva modifiche"
          />
          <PulsanteEliminaSquadra codiceStagione={codice} id={squadra.id} nome={squadra.nome} />
        </div>
      ) : (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">
          {stagione.stato === 'chiusa'
            ? 'Stagione chiusa: la squadra è in sola lettura.'
            : 'Non hai i permessi per modificare questa squadra.'}
        </p>
      )}
    </section>
  )
}
