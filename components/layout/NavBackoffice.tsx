import Link from 'next/link'
import type { RuoloApp } from '@/lib/auth/session'
import type { Stagione } from '@/lib/repos/stagioni'

export function NavBackoffice({ ruolo, stagioni }: { ruolo: RuoloApp; stagioni: Stagione[] }) {
  const corrente = stagioni.find((s) => s.stato === 'aperta') ?? stagioni[0]

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 p-4 text-sm">
        <Link href="/gestione" className="font-semibold">Virpol</Link>
        {corrente && (
          <>
            <Link href={`/${corrente.codice}/squadre`}>Squadre</Link>
            <Link href={`/${corrente.codice}/tesseramenti`}>Tesserati</Link>
            <Link href={`/${corrente.codice}/presenze`}>Presenze</Link>
          </>
        )}
        <Link href="/anagrafica">Anagrafica</Link>
        {ruolo === 'admin' && <Link href="/admin/stagioni">Stagioni</Link>}
        <form action="/logout" method="post" className="ml-auto">
          <button type="submit" className="text-neutral-600 underline">Esci</button>
        </form>
      </nav>
    </header>
  )
}
