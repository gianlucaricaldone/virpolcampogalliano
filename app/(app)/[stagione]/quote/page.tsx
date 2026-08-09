import { redirect } from 'next/navigation'
import { PannelloImporti } from '@/components/quote/PannelloImporti'
import { TabellaQuote } from '@/components/quote/TabellaQuote'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { formattaEuro } from '@/lib/domain/denaro'
import { importiPerSquadra, importoStagione, statoQuote } from '@/lib/repos/quote'
import { elencaSquadre } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'
import { impostaImportoAzione, rimuoviImportoAzione } from './actions'

export default async function PaginaQuote({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ squadra?: string; aperte?: string }>
}) {
  const { stagione: codice } = await params
  const { squadra, aperte } = await searchParams
  const [stagione, db, sessione] = await Promise.all([
    stagioneRichiesta(codice),
    supabaseServer(),
    sessioneCorrente(),
  ])
  // Le due tabelle finanziarie non hanno policy per l'allenatore: leggerebbe
  // zeri ovunque. Meglio non mostrargli affatto una pagina di sole cifre finte.
  if (sessione?.ruolo !== 'admin' && sessione?.ruolo !== 'dirigente') redirect(`/${codice}`)

  // Tre letture indipendenti, insieme. `importiPerSquadra` resta fuori perché
  // ha bisogno degli id delle squadre: è l'unica vera dipendenza qui, quindi
  // due ondate invece di cinque round trip in fila.
  const [squadre, righe, importoDiStagione] = await Promise.all([
    elencaSquadre(db, stagione.id),
    statoQuote(db, stagione.id, {
      squadraId: squadra || undefined,
      soloNonSaldate: aperte === '1',
    }),
    importoStagione(db, stagione.id),
  ])
  const importiSquadre = Object.fromEntries(
    await importiPerSquadra(db, squadre.map((s) => s.id)),
  )
  const modificabile = stagione.stato === 'aperta'

  const totali = righe.reduce(
    (acc, r) => ({
      attesa: acc.attesa + r.quotaAttesa,
      pagato: acc.pagato + r.pagato,
      residuo: acc.residuo + Math.max(r.residuo, 0),
    }),
    { attesa: 0, pagato: 0, residuo: 0 },
  )

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Quote {stagione.etichetta}</h1>

      <PannelloImporti
        etichettaStagione={stagione.etichetta}
        squadre={squadre}
        importoStagione={importoDiStagione}
        importiSquadre={importiSquadre}
        azioneStagione={impostaImportoAzione.bind(null, codice, { stagioneId: stagione.id })}
        azioniSquadre={Object.fromEntries(
          squadre.map((s) => [s.id, impostaImportoAzione.bind(null, codice, { squadraId: s.id })]),
        )}
        rimozioniSquadre={Object.fromEntries(
          // quote_del è riservata all'admin: al dirigente il pulsante non compare.
          sessione.ruolo === 'admin' && modificabile
            ? squadre.map((s) => [s.id, rimuoviImportoAzione.bind(null, codice, { squadraId: s.id })])
            : [],
        )}
        modificabile={modificabile}
      />

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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="aperte" value="1" defaultChecked={aperte === '1'} />
          Solo chi non ha saldato
        </label>
        <button type="submit" className="bottone-secondario">Filtra</button>
      </form>

      <p className="text-sm text-neutral-600">
        {righe.length} {righe.length === 1 ? 'tesserato' : 'tesserati'} · atteso{' '}
        {formattaEuro(totali.attesa)} · versato {formattaEuro(totali.pagato)} · da incassare{' '}
        {formattaEuro(totali.residuo)}
      </p>

      <TabellaQuote righe={righe} codiceStagione={codice} />
    </section>
  )
}
