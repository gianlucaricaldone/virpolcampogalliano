import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FormTesseramento } from '@/components/tesseramenti/FormTesseramento'
import { getSessione } from '@/lib/auth/session'
import { elencaPersone } from '@/lib/repos/persone'
import { elencaSquadre } from '@/lib/repos/squadre'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import { creaTesseramentoAzione } from '../actions'

export default async function PaginaNuovoTesseramento({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { stagione: codice } = await params
  const { q } = await searchParams
  const stagione = await stagioneRichiesta(codice)

  const db = await supabaseServer()
  const sessione = await getSessione(db)
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'
  if (!puoScrivere) redirect(`/${codice}/tesseramenti`)

  const squadre = await elencaSquadre(db, stagione.id)
  // Si cerca prima di elencare: senza una ricerca l'anagrafica intera finirebbe
  // in una lista di radio button, e nessuno la scorre.
  const trovate = q ? await elencaPersone(db, { cognome: q, soloAttive: true }) : []
  const giaTesserati = new Set(
    q ? (await elencaTesseramenti(db, stagione.id)).map((t) => t.persona.id) : [],
  )
  const candidati = trovate.filter((p) => !giaTesserati.has(p.id))

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Nuovo tesseramento — {stagione.etichetta}</h1>
      <p className="text-sm text-neutral-600">
        Si cerca nell&apos;anagrafica e si tessera: la persona è permanente, il tesseramento vale
        una stagione sola.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Cognome</label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Cerca in anagrafica"
            className="mt-1 rounded border px-2 py-1"
          />
        </div>
        <button type="submit" className="rounded border px-3 py-2 text-sm">Cerca</button>
      </form>

      {q && candidati.length === 0 && (
        <p className="rounded border bg-white p-4 text-neutral-600">
          {trovate.length > 0
            ? 'Le persone trovate sono già tesserate in questa stagione.'
            : 'Nessuna persona trovata. '}
          <Link href="/anagrafica/nuova" className="underline">
            Inseriscila in anagrafica
          </Link>
          .
        </p>
      )}

      {candidati.length > 0 && (
        <FormTesseramento
          azione={creaTesseramentoAzione.bind(null, codice)}
          candidati={candidati}
          squadre={squadre}
        />
      )}
    </section>
  )
}
