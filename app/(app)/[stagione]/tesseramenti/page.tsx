import Link from 'next/link'
import { TabellaTesserati } from '@/components/tesseramenti/TabellaTesserati'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { statoQuote } from '@/lib/repos/quote'
import { elencaSquadre } from '@/lib/repos/squadre'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { statoVisite } from '@/lib/repos/visite'
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
  const staff = sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente'
  // `statoQuote` solo per lo staff: per l'allenatore v_quote risponde "saldato"
  // per chiunque, perché le tabelle finanziarie non hanno policy per lui.
  const [squadre, tesserati, quote, visite] = await Promise.all([
    elencaSquadre(db, stagione.id),
    elencaTesseramenti(db, stagione.id, {
      squadraId: senzaSquadra ? undefined : squadra || undefined,
      senzaSquadra,
    }),
    staff ? statoQuote(db, stagione.id) : [],
    statoVisite(db, stagione.id),
  ])
  const quotaPerTesseramento = new Map(quote.map((q) => [q.tesseramentoId, q.stato]))
  const visitaConsegnata = new Map(visite.map((v) => [v.tesseramentoId, v.consegnata]))

  const puoScrivere = staff && stagione.stato === 'aperta'

  return (
    <section className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Tesserati {stagione.etichetta}</h1>
        {puoScrivere && (
          <Link
            href={`/${codice}/tesseramenti/nuovo`}
            className="bottone"
          >
            Tessera una persona
          </Link>
        )}
      </div>

      <TabellaTesserati
        tesserati={tesserati}
        codiceStagione={codice}
        quotaPerTesseramento={quotaPerTesseramento}
        visitaConsegnata={visitaConsegnata}
        mostraQuota={staff}
        squadre={squadre}
        squadraSelezionata={squadra ?? ''}
        senzaSquadra={senzaSquadra}
      />
    </section>
  )
}
