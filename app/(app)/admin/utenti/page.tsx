import { redirect } from 'next/navigation'
import { FormNuovoUtente } from '@/components/utenti/FormNuovoUtente'
import { TabellaUtenti } from '@/components/utenti/TabellaUtenti'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaPersone } from '@/lib/repos/persone'
import { elencaUtenti } from '@/lib/repos/utenti'
import { supabaseServer } from '@/lib/supabase/server'
import { aggiornaUtenteAzione, creaUtenteAzione, reimpostaPasswordAzione } from './actions'

export default async function PaginaUtenti({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [db, sessione] = await Promise.all([supabaseServer(), sessioneCorrente()])
  if (sessione?.ruolo !== 'admin') redirect('/gestione')

  // Come nel tesseramento: si cerca prima di elencare, altrimenti l'anagrafica
  // intera finisce in una lista di radio button.
  const [utenti, candidati] = await Promise.all([
    elencaUtenti(db),
    q ? elencaPersone(db, { cognome: q, soloAttive: true }) : [],
  ])

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Utenti</h1>
      <p className="text-sm text-neutral-600">
        La password iniziale si legge una volta dopo la creazione e si comunica a voce.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Cerca in anagrafica</label>
          <input id="q" name="q" defaultValue={q ?? ''} placeholder="Cognome"
                 className="mt-1 rounded border px-2 py-1" />
        </div>
        <button type="submit" className="rounded border px-3 py-2 text-sm">Cerca</button>
      </form>

      <FormNuovoUtente azione={creaUtenteAzione} candidati={candidati} />

      <TabellaUtenti
        utenti={utenti}
        idCorrente={sessione.userId}
        aggiorna={aggiornaUtenteAzione}
        reimposta={reimpostaPasswordAzione}
      />
    </section>
  )
}
