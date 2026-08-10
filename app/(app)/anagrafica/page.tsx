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

  // Nessun `cognome` nel filtro: quello lo applica TabellaPersone mentre si
  // scrive, e un filtro anche qui renderebbe impossibile allargare la ricerca
  // senza ricaricare — il client avrebbe solo il sottoinsieme già scaricato.
  // `soloAttive` invece decide quali righe leggere, e resta qui.
  const persone = await elencaPersone(db, { soloAttive: archiviate !== '1' })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Anagrafica</h1>
        {puoScrivere && (
          <Link
            href="/anagrafica/nuova"
            className="bottone"
          >
            Nuova persona
          </Link>
        )}
      </div>

      {sessione?.ruolo === 'allenatore' && (
        <p className="rounded bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Vedi solo le persone tesserate o in staff nelle tue squadre.
        </p>
      )}

      <TabellaPersone
        persone={persone}
        ricercaIniziale={q ?? ''}
        mostraArchiviate={archiviate === '1'}
      />
    </section>
  )
}
