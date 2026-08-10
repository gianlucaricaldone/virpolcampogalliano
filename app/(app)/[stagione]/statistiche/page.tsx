import { RiepilogoSquadre } from '@/components/statistiche/RiepilogoSquadre'
import { TabellaStatistiche } from '@/components/statistiche/TabellaStatistiche'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { squadreDiStaff } from '@/lib/repos/incarichi'
import { elencaSquadre } from '@/lib/repos/squadre'
import { etichettaMese } from '@/lib/domain/data'
import {
  mesiConSedute,
  statistichePerGiocatore,
  statistichePerSquadra,
} from '@/lib/repos/statistiche'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function PaginaStatistiche({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ squadra?: string; mese?: string }>
}) {
  const { stagione: codice } = await params
  const { squadra, mese } = await searchParams
  const [stagione, db, sessione] = await Promise.all([
    stagioneRichiesta(codice),
    supabaseServer(),
    sessioneCorrente(),
  ])

  // Come nelle presenze: `squadre_sel` è `using (true)`, quindi senza filtrare
  // un allenatore avrebbe nel menù squadre che poi risultano vuote.
  // Tre letture indipendenti: l'elenco delle squadre serve solo a filtrare
  // quelle di squadra a valle, non a costruire le altre due query.
  const [squadre, giocatori, tutteLeSquadre, mesi] = await Promise.all([
    sessione?.ruolo === 'allenatore' && sessione.personaId
      ? squadreDiStaff(db, sessione.personaId, stagione.id)
      : elencaSquadre(db, stagione.id),
    statistichePerGiocatore(db, stagione.id, {
      squadraId: squadra || undefined,
      mese: mese || undefined,
    }),
    statistichePerSquadra(db, stagione.id, { mese: mese || undefined }),
    mesiConSedute(db, stagione.id),
  ])
  const perSquadra = tutteLeSquadre.filter(
    (r) =>
      squadre.some((s) => s.id === r.squadraId) && (!squadra || r.squadraId === squadra),
  )

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Statistiche presenze {stagione.etichetta}</h1>

      {/* Il periodo scelto va detto anche fuori dal menù: chi arriva su un
          collegamento filtrato, o riapre la pagina, deve capire perché le
          percentuali non sono quelle della stagione. */}
      {mese && (
        <p className="rounded border-2 border-[var(--colore-nero)] bg-[var(--colore-giallo)] px-3 py-1.5 text-sm">
          Solo {etichettaMese(mese)}: il denominatore sono le sedute di questo mese.
        </p>
      )}

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
          {mesi.length > 0 && (
            <div>
              <label htmlFor="mese" className="block text-sm font-medium">Mese</label>
              <select
                id="mese"
                name="mese"
                defaultValue={mese ?? ''}
                className="mt-1.5 rounded-md border px-3 text-sm"
              >
                <option value="">Tutta la stagione</option>
                {mesi.map((m) => (
                  <option key={m} value={m}>{etichettaMese(m)}</option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="bottone-secondario">Filtra</button>
        </form>
      )}

      {/* Due region con un nome: le stesse squadre compaiono in entrambe le
          tabelle, e senza un contenitore nominato non c'è modo — né per una
          tecnologia assistiva né per un test — di dire di quale si parla. */}
      <section aria-labelledby="titolo-squadre" className="space-y-2">
        <h2 id="titolo-squadre" className="text-lg font-semibold">Per squadra</h2>
        <RiepilogoSquadre righe={perSquadra} />
      </section>

      <section aria-labelledby="titolo-giocatori" className="space-y-2">
        <h2 id="titolo-giocatori" className="text-lg font-semibold">Per giocatore</h2>
        <p className="text-sm text-neutral-600">
          Il denominatore sono tutte le sedute della squadra: chi si tessera a stagione iniziata ha
          una percentuale bassa e molte non registrate. È la lettura onesta, non un errore.
        </p>
        <TabellaStatistiche
          righe={giocatori}
          codiceStagione={codice}
          mostraSquadra={!squadra}
        />
      </section>
    </section>
  )
}
