import Link from 'next/link'
import { TabellaPersone } from '@/components/persone/TabellaPersone'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaPersone } from '@/lib/repos/persone'
import { supabaseServer } from '@/lib/supabase/server'

export default async function PaginaAnagrafica({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archiviate?: string }>
}) {
  const { q, archiviate } = await searchParams
  const [db, sessione] = await Promise.all([supabaseServer(), sessioneCorrente()])
  const puoScrivere = sessione?.ruolo === 'admin' || sessione?.ruolo === 'dirigente'

  const persone = await elencaPersone(db, {
    cognome: q,
    soloAttive: archiviate !== '1',
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Anagrafica</h1>
        {puoScrivere && (
          <Link
            href="/anagrafica/nuova"
            className="inline-flex min-h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Nuova persona
          </Link>
        )}
      </div>

      {/* Form GET, non un client component: la ricerca finisce nell'URL, quindi
          è condivisibile, torna indietro con il tasto del browser e funziona
          senza JavaScript. */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Cognome</label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Cerca per cognome"
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archiviate" value="1" defaultChecked={archiviate === '1'} />
          Mostra anche le archiviate
        </label>
        <button type="submit" className="min-h-10 rounded-md border px-4 text-sm hover:bg-neutral-50">Cerca</button>
      </form>

      {sessione?.ruolo === 'allenatore' && (
        <p className="rounded bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Vedi solo le persone tesserate o in staff nelle tue squadre.
        </p>
      )}

      <TabellaPersone persone={persone} />
    </section>
  )
}
