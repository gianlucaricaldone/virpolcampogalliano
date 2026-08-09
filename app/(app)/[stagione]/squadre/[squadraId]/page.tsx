import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloStaff } from '@/components/incarichi/PannelloStaff'
import { FormSquadra } from '@/components/squadre/FormSquadra'
import { PulsanteEliminaSquadra } from '@/components/squadre/PulsanteEliminaSquadra'
import { SezioneRosa } from '@/components/tesseramenti/SezioneRosa'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaIncarichi } from '@/lib/repos/incarichi'
import { elencaPersone } from '@/lib/repos/persone'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import {
  aggiornaSquadraAzione,
  creaGiocatoreNellaSquadraAzione,
  creaIncaricoAzione,
  rimuoviIncaricoAzione,
  tesseraNellaSquadraAzione,
} from '../actions'
import { caricaSquadra } from './dati'

export default async function PaginaSquadra({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string; squadraId: string }>
  searchParams: Promise<{ staff?: string; rosa?: string }>
}) {
  const { stagione: codice, squadraId } = await params
  const { staff, rosa: ricercaRosa } = await searchParams
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

  // Rosa, staff e candidati non dipendono l'uno dall'altro: la sottrazione fra
  // candidati e staff già assegnato si fa dopo, in memoria.
  // La ricerca precede l'elenco: l'anagrafica intera in una lista di radio
  // button non la scorre nessuno.
  // `tesseratiStagione` serve solo a sottrarre i candidati già tesserati: si
  // legge unicamente quando c'è una ricerca in corso.
  const [rosa, incarichi, trovateStaff, trovateRosa, tesseratiStagione] = await Promise.all([
    elencaTesseramenti(db, stagione.id, { squadraId: squadra.id }),
    elencaIncarichi(db, squadra.id),
    puoScrivere && staff ? elencaPersone(db, { cognome: staff, soloAttive: true }) : [],
    puoScrivere && ricercaRosa ? elencaPersone(db, { cognome: ricercaRosa, soloAttive: true }) : [],
    puoScrivere && ricercaRosa ? elencaTesseramenti(db, stagione.id) : [],
  ])
  const giaStaff = new Set(incarichi.map((i) => i.persona.id))
  const candidati = trovateStaff.filter((p) => !giaStaff.has(p.id))
  // Il tesseramento è unico per persona e stagione, non per squadra: chi è già
  // tesserato altrove non è un candidato, va spostato dalla sua scheda.
  const giaTesserati = new Set(tesseratiStagione.map((t) => t.persona.id))
  const candidatiRosa = trovateRosa.filter((p) => !giaTesserati.has(p.id))

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
        ricerca={ricercaRosa}
        trovate={trovateRosa}
        candidati={candidatiRosa}
        azione={tesseraNellaSquadraAzione.bind(null, codice, squadra.id)}
        azioneNuovo={creaGiocatoreNellaSquadraAzione.bind(null, codice, squadra.id)}
        modificabile={puoScrivere}
      />

      <div>
        <h2 className="mb-2 text-lg font-semibold">Staff</h2>
        {puoScrivere && (
          <form method="get" className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="staff" className="block text-sm font-medium">
                Cerca in anagrafica
              </label>
              <input
                id="staff"
                name="staff"
                defaultValue={staff ?? ''}
                placeholder="Cognome"
                className="mt-1.5 rounded-md border px-3 text-sm"
              />
            </div>
            <button type="submit" className="bottone-secondario">Cerca</button>
          </form>
        )}
        <PannelloStaff
          incarichi={incarichi}
          candidati={candidati}
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
