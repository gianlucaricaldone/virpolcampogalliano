import type { StatisticaSquadra } from '@/lib/repos/statistiche'
import { Tabella } from '../ui/Tabella'

export function RiepilogoSquadre({ righe }: { righe: StatisticaSquadra[] }) {
  if (righe.length === 0) return null

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Squadra</th>
          <th>Tesserati</th>
          <th>Sedute</th>
          <th>Presenze</th>
          <th>Non registrate</th>
          <th>Media</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.squadraId}>
            <td className="font-medium">{r.nome}</td>
            <td className="text-neutral-600">{r.tesserati}</td>
            <td className="text-neutral-600">{r.sedute}</td>
            <td className="text-neutral-600">{r.presenti}</td>
            <td className="text-neutral-600">{r.nonRegistrate}</td>
            <td className="font-medium">
              {r.percentuale === null ? '—' : `${r.percentuale.toFixed(1)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
