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
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessuna squadra in questa stagione.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Squadra</th>
          <th>Categoria</th>
          <th>Annata</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {squadre.map((s) => (
          <tr key={s.id}>
            <td className="font-medium">
              <Link href={`/${codiceStagione}/squadre/${s.id}`} className="underline">
                {s.nome}
              </Link>
            </td>
            <td className="text-neutral-600">{s.categoria}</td>
            <td className="text-neutral-600">{s.annata ?? '—'}</td>
            <td className="text-neutral-600">{s.note ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
