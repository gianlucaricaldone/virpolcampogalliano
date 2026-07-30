import Link from 'next/link'
import { TabellaTesserati } from '@/components/tesseramenti/TabellaTesserati'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaSquadre } from '@/lib/repos/squadre'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function PaginaTesseramenti({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ squadra?: string; senza?: string }>
}) {
  const { stagione: codice } = await params
  const { squadra, senza } = await searchParams
  const stagione = await stagioneRichiesta(codice)

  const [db, sessione] = await Promise.all([supabaseServer(), sessioneCorrente()])
  const senzaSquadra = senza === '1'
  // Il menù delle squadre e l'elenco dei tesserati non dipendono l'uno
  // dall'altro.
  const [squadre, tesserati] = await Promise.all([
    elencaSquadre(db, stagione.id),
    elencaTesseramenti(db, stagione.id, {
      squadraId: senzaSquadra ? undefined : squadra || undefined,
      senzaSquadra,
    }),
  ])

  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Tesserati {stagione.etichetta}</h1>
        {puoScrivere && (
          <Link
            href={`/${codice}/tesseramenti/nuovo`}
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Tessera una persona
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div>
          <label htmlFor="squadra" className="block text-sm font-medium">Squadra</label>
          <select
            id="squadra"
            name="squadra"
            defaultValue={squadra ?? ''}
            className="mt-1 rounded border px-2 py-1"
          >
            <option value="">Tutte</option>
            {squadre.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          {/* Ha la precedenza sul filtro per squadra: sono due domande diverse
              e sceglierne una sola evita un elenco vuoto senza spiegazione. */}
          <input type="checkbox" name="senza" value="1" defaultChecked={senzaSquadra} />
          Solo chi non ha una squadra
        </label>
        <button type="submit" className="rounded border px-3 py-2 text-sm">Filtra</button>
      </form>

      <p className="text-sm text-neutral-600">
        {tesserati.length} {tesserati.length === 1 ? 'tesserato' : 'tesserati'}
      </p>
      <TabellaTesserati tesserati={tesserati} codiceStagione={codice} />
    </section>
  )
}
