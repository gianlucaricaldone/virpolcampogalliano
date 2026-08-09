import { RiquadroQuote } from '@/components/scadenze/RiquadroQuote'
import { RiquadroVisite } from '@/components/scadenze/RiquadroVisite'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { scadenzeStagione } from '@/lib/repos/scadenze'
import { elencaSquadre } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function Cruscotto({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ squadra?: string }>
}) {
  const { stagione: codice } = await params
  const { squadra } = await searchParams
  const [stagione, db, sessione] = await Promise.all([
    stagioneRichiesta(codice),
    supabaseServer(),
    sessioneCorrente(),
  ])

  // Il menù a tendina e i due riquadri sono indipendenti.
  // All'allenatore le quote non si nascondono via interfaccia: non si
  // chiedono. Non ha policy sulle tabelle finanziarie, quindi leggerebbe zeri
  // — cifre finte presentate come vere, che è peggio di non mostrarle.
  const [squadre, { quote, visite }] = await Promise.all([
    elencaSquadre(db, stagione.id),
    scadenzeStagione(db, stagione.id, {
      squadraId: squadra || undefined,
      includiQuote: sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente',
    }),
  ])

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Stagione {stagione.etichetta}</h1>

      {squadre.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <div>
            <label htmlFor="squadra" className="block text-sm font-medium">Squadra</label>
            <select
              id="squadra"
              name="squadra"
              defaultValue={squadra ?? ''}
              className="mt-1.5 rounded-md border px-3 text-sm"
            >
              <option value="">Tutte</option>
              {squadre.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bottone-secondario">Filtra</button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <RiquadroVisite righe={visite} codiceStagione={codice} />
        {quote && <RiquadroQuote righe={quote} codiceStagione={codice} />}
      </div>
    </section>
  )
}
