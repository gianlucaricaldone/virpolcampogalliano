import Link from 'next/link'
import type { Squadra } from '@/lib/repos/squadre'
import { Tabella } from '../ui/Tabella'

export function TabellaSquadre({
  squadre,
  codiceStagione,
}: {
  squadre: Squadra[]
  codiceStagione: string
}) {
  if (squadre.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna squadra in questa stagione.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Squadra</th>
          <th className="p-2">Categoria</th>
          <th className="p-2">Annata</th>
          <th className="p-2">Note</th>
        </tr>
      </thead>
      <tbody>
        {squadre.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="p-2 font-medium">
              <Link href={`/${codiceStagione}/squadre/${s.id}`} className="underline">
                {s.nome}
              </Link>
            </td>
            <td className="p-2 text-neutral-600">{s.categoria}</td>
            <td className="p-2 text-neutral-600">{s.annata ?? '—'}</td>
            <td className="p-2 text-neutral-600">{s.note ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
