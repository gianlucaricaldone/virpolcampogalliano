import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PannelloStaff } from '@/components/incarichi/PannelloStaff'
import { FormSquadra } from '@/components/squadre/FormSquadra'
import { PulsanteEliminaSquadra } from '@/components/squadre/PulsanteEliminaSquadra'
import { TabellaTesserati } from '@/components/tesseramenti/TabellaTesserati'
import { getSessione } from '@/lib/auth/session'
import { elencaIncarichi } from '@/lib/repos/incarichi'
import { elencaPersone } from '@/lib/repos/persone'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import { aggiornaSquadraAzione, creaIncaricoAzione, rimuoviIncaricoAzione } from '../actions'
import { caricaSquadra } from './dati'

export default async function PaginaSquadra({
  params,
  searchParams,
}: {
  params: Promise<{ stagione: string; squadraId: string }>
  searchParams: Promise<{ staff?: string }>
}) {
  const { stagione: codice, squadraId } = await params
  const { staff } = await searchParams
  const stagione = await stagioneRichiesta(codice)
  // Il layout ha già deciso il 404: qui la lettura arriva dalla cache.
  const squadra = await caricaSquadra(squadraId)
  if (!squadra) notFound()

  const db = await supabaseServer()
  const sessione = await getSessione(db)
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'

  const rosa = await elencaTesseramenti(db, stagione.id, { squadraId: squadra.id })
  const incarichi = await elencaIncarichi(db, squadra.id)
  // La ricerca precede l'elenco: l'anagrafica intera in una lista di radio
  // button non la scorre nessuno.
  const giaStaff = new Set(incarichi.map((i) => i.persona.id))
  const candidati =
    puoScrivere && staff
      ? (await elencaPersone(db, { cognome: staff, soloAttive: true })).filter(
          (p) => !giaStaff.has(p.id),
        )
      : []

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

      <div>
        <h2 className="mb-2 text-lg font-semibold">Rosa ({rosa.length})</h2>
        <TabellaTesserati tesserati={rosa} codiceStagione={codice} mostraSquadra={false} />
      </div>

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
                className="mt-1 rounded border px-2 py-1"
              />
            </div>
            <button type="submit" className="rounded border px-3 py-2 text-sm">Cerca</button>
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
        <p className="rounded border bg-white p-4 text-neutral-600">
          {stagione.stato === 'chiusa'
            ? 'Stagione chiusa: la squadra è in sola lettura.'
            : 'Non hai i permessi per modificare questa squadra.'}
        </p>
      )}
    </section>
  )
}
