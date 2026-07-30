import Link from 'next/link'
import { formattaData } from '@/lib/domain/data'
import type { Persona } from '@/lib/repos/persone'

export function TabellaPersone({ persone }: { persone: Persona[] }) {
  if (persone.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna persona corrisponde alla ricerca.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Cognome e nome</th>
          <th className="p-2">Nascita</th>
          <th className="p-2">Codice fiscale</th>
          <th className="p-2">Recapiti</th>
          <th className="p-2">Stato</th>
        </tr>
      </thead>
      <tbody>
        {persone.map((p) => (
          <tr key={p.id} className="border-t">
            <td className="p-2 font-medium">
              <Link href={`/anagrafica/${p.id}`} className="underline">
                {p.cognome} {p.nome}
              </Link>
            </td>
            <td className="p-2 text-neutral-600">{formattaData(p.dataNascita)}</td>
            <td className="p-2 text-neutral-600">{p.codiceFiscale ?? '—'}</td>
            <td className="p-2 text-neutral-600">{p.telefono ?? p.email ?? '—'}</td>
            <td className="p-2">
              {p.attiva ? (
                <span className="text-neutral-600">attiva</span>
              ) : (
                <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">
                  archiviata
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
