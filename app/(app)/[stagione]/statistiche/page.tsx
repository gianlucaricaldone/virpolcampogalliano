import { RiepilogoSquadre } from '@/components/statistiche/RiepilogoSquadre'
import { TabellaStatistiche } from '@/components/statistiche/TabellaStatistiche'
import { getSessione } from '@/lib/auth/session'
import { squadreDiStaff } from '@/lib/repos/incarichi'
import { elencaSquadre } from '@/lib/repos/squadre'
import { statistichePerGiocatore, statistichePerSquadra } from '@/lib/repos/statistiche'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function PaginaStatistiche({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string }>
  searchParams: Promise<{ squadra?: string }>
}) {
  const { stagione: codice } = await params
  const { squadra } = await searchParams
  const stagione = await stagioneRichiesta(codice)

  const db = await supabaseServer()
  const sessione = await getSessione(db)

  // Come nelle presenze: `squadre_sel` è `using (true)`, quindi senza filtrare
  // un allenatore avrebbe nel menù squadre che poi risultano vuote.
  const squadre =
    sessione?.ruolo === 'allenatore' && sessione.personaId
      ? await squadreDiStaff(db, sessione.personaId, stagione.id)
      : await elencaSquadre(db, stagione.id)

  const giocatori = await statistichePerGiocatore(db, stagione.id, {
    squadraId: squadra || undefined,
  })
  const perSquadra = (await statistichePerSquadra(db, stagione.id)).filter(
    (r) =>
      squadre.some((s) => s.id === r.squadraId) && (!squadra || r.squadraId === squadra),
  )

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Statistiche presenze {stagione.etichetta}</h1>

      {squadre.length > 0 && (
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
          <button type="submit" className="rounded border px-3 py-2 text-sm">Filtra</button>
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
