import type { StatisticaSquadra } from '@/lib/repos/statistiche'

export function RiepilogoSquadre({ righe }: { righe: StatisticaSquadra[] }) {
  if (righe.length === 0) return null

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Squadra</th>
          <th className="p-2">Tesserati</th>
          <th className="p-2">Sedute</th>
          <th className="p-2">Presenze</th>
          <th className="p-2">Non registrate</th>
          <th className="p-2">Media</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.squadraId} className="border-t">
            <td className="p-2 font-medium">{r.nome}</td>
            <td className="p-2 text-neutral-600">{r.tesserati}</td>
            <td className="p-2 text-neutral-600">{r.sedute}</td>
            <td className="p-2 text-neutral-600">{r.presenti}</td>
            <td className="p-2 text-neutral-600">{r.nonRegistrate}</td>
            <td className="p-2 font-medium">
              {r.percentuale === null ? '—' : `${r.percentuale.toFixed(1)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
