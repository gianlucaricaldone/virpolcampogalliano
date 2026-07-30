import Link from 'next/link'
import { formattaData } from '@/lib/domain/data'
import type { Seduta } from '@/lib/repos/presenze'
import { Tabella } from '../ui/Tabella'

export function ElencoSedute({
  sedute,
  codiceStagione,
  squadraId,
  totaleRosa,
}: {
  sedute: Seduta[]
  codiceStagione: string
  squadraId: string
  totaleRosa: number
}) {
  if (sedute.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna seduta registrata per questa squadra.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Data</th>
          <th className="p-2">Ora</th>
          <th className="p-2">Compilate</th>
          <th className="p-2">Note</th>
        </tr>
      </thead>
      <tbody>
        {sedute.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="p-2 font-medium">
              <Link
                href={`/${codiceStagione}/presenze/${squadraId}/${s.id}`}
                className="underline"
              >
                {formattaData(s.data)}
              </Link>
            </td>
            <td className="p-2 text-neutral-600">{s.oraInizio?.slice(0, 5) ?? '—'}</td>
            <td className="p-2 text-neutral-600">
              {/* Il denominatore è la rosa di oggi: una seduta "0 su 18" è un
                  foglio mai compilato, e va distinta da una in cui erano tutti
                  assenti. */}
              {s.registrate} su {totaleRosa}
              {s.registrate === 0 && (
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                  da compilare
                </span>
              )}
            </td>
            <td className="p-2 text-neutral-600">{s.note ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
