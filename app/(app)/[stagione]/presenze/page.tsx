import Link from 'next/link'
import { getSessione } from '@/lib/auth/session'
import { squadreDiStaff } from '@/lib/repos/incarichi'
import { elencaSquadre } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../dati'

export default async function PaginaPresenze({
  params,
}: {
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  const stagione = await stagioneRichiesta(codice)

  const db = await supabaseServer()
  const sessione = await getSessione(db)

  // `squadre_sel` è `using (true)`: senza filtrare, un allenatore vedrebbe
  // tutte le squadre e finirebbe su elenchi di sedute vuoti, senza capire se
  // il problema è che non ci sono sedute o che non sono sue.
  const squadre =
    sessione?.ruolo === 'allenatore' && sessione.personaId
      ? await squadreDiStaff(db, sessione.personaId, stagione.id)
      : await elencaSquadre(db, stagione.id)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Presenze {stagione.etichetta}</h1>

      {squadre.length === 0 ? (
        <p className="rounded border bg-white p-4 text-neutral-600">
          {sessione?.ruolo === 'allenatore'
            ? 'Non hai incarichi su nessuna squadra di questa stagione.'
            : 'Nessuna squadra in questa stagione.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {squadre.map((s) => (
            <li key={s.id}>
              <Link
                href={`/${codice}/presenze/${s.id}`}
                className="block rounded border bg-white p-4 hover:bg-neutral-50"
              >
                <span className="font-medium">{s.nome}</span>
                <span className="mt-1 block text-sm text-neutral-600">
                  Sedute e foglio presenze
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
