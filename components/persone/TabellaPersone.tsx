import Link from 'next/link'
import { formattaData } from '@/lib/domain/data'
import type { Persona } from '@/lib/repos/persone'
import { Tabella } from '../ui/Tabella'

export function TabellaPersone({ persone }: { persone: Persona[] }) {
  if (persone.length === 0) {
    return (
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessuna persona corrisponde alla ricerca.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Cognome e nome</th>
          <th>Nascita</th>
          <th>Codice fiscale</th>
          <th>Recapiti</th>
          <th>Stato</th>
        </tr>
      </thead>
      <tbody>
        {persone.map((p) => (
          <tr key={p.id}>
            <td className="font-medium">
              <Link href={`/anagrafica/${p.id}`} className="underline">
                {p.cognome} {p.nome}
              </Link>
            </td>
            <td className="text-neutral-600">{formattaData(p.dataNascita)}</td>
            <td className="text-neutral-600">{p.codiceFiscale ?? '—'}</td>
            <td className="text-neutral-600">{p.telefono ?? p.email ?? '—'}</td>
            <td>
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
    </Tabella>
  )
}
