import Link from 'next/link'
import type { StatisticaGiocatore } from '@/lib/repos/statistiche'
import { Tabella } from '../ui/Tabella'

function percentuale(valore: number | null): string {
  // Nulla non è zero: la squadra non ha ancora fatto allenamenti, quindi la
  // percentuale non esiste. Scriverci 0% direbbe una cosa falsa.
  return valore === null ? '—' : `${valore.toFixed(1)}%`
}

export function TabellaStatistiche({
  righe,
  codiceStagione,
  mostraSquadra,
}: {
  righe: StatisticaGiocatore[]
  codiceStagione: string
  mostraSquadra: boolean
}) {
  if (righe.length === 0) {
    return (
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessun tesserato corrisponde a questi filtri.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Giocatore</th>
          {mostraSquadra && <th>Squadra</th>}
          <th>Presenze</th>
          <th>Assenze</th>
          <th>Giustificate</th>
          <th>Infortuni</th>
          <th>Non registrate</th>
          <th>Percentuale</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.tesseramentoId}>
            <td className="font-medium">
              <Link
                href={`/${codiceStagione}/tesseramenti/${r.tesseramentoId}`}
                className="underline"
              >
                {r.persona.cognome} {r.persona.nome}
              </Link>
            </td>
            {mostraSquadra && (
              <td className="text-neutral-600">{r.squadra?.nome ?? '—'}</td>
            )}
            <td>{r.presenti} su {r.seduteSquadra}</td>
            <td className="text-neutral-600">{r.assenti}</td>
            <td className="text-neutral-600">{r.giustificati}</td>
            <td className="text-neutral-600">{r.infortuni}</td>
            <td>
              {/* Accanto alla percentuale e non nascosto: è il numero che
                  spiega una percentuale bassa senza doverla aggiustare. */}
              {r.nonRegistrate > 0 ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                  {r.nonRegistrate}
                </span>
              ) : (
                <span className="text-neutral-600">0</span>
              )}
            </td>
            <td className="font-medium">{percentuale(r.percentuale)}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
