import Link from 'next/link'
import { TabellaSquadre } from '@/components/squadre/TabellaSquadre'
import { getSessione } from '@/lib/auth/session'
import { elencaSquadre } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function PaginaSquadre({
  params,
}: {
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  const stagione = await stagioneRichiesta(codice)

  const db = await supabaseServer()
  const sessione = await getSessione(db)
  const squadre = await elencaSquadre(db, stagione.id)

  // Le policy negano comunque la scrittura su stagione chiusa. Qui si evita
  // di offrire un pulsante che porterebbe solo a un errore.
  const puoScrivere =
    (sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente') &&
    stagione.stato === 'aperta'

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Squadre {stagione.etichetta}</h1>
        {puoScrivere && (
          <Link
            href={`/${codice}/squadre/nuova`}
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Nuova squadra
          </Link>
        )}
      </div>
      <TabellaSquadre squadre={squadre} codiceStagione={codice} />
    </section>
  )
}
