import Link from 'next/link'
import { formattaEuro } from '@/lib/domain/denaro'
import { COLORE_QUOTA, ETICHETTA_QUOTA } from '@/lib/domain/quota'
import type { LivelloImporto, RigaQuota } from '@/lib/repos/quote'
import { Tabella } from '../ui/Tabella'

const ETICHETTA_LIVELLO: Record<LivelloImporto, string> = {
  tesseramento: 'personale',
  squadra: 'squadra',
  stagione: 'stagione',
  nessuno: 'non configurata',
}

/**
 * Stato e cifre arrivano da `v_quote` e si mostrano così come sono: nessun
 * ricalcolo qui, altrimenti l'elenco e la scheda finirebbero per dire cose
 * diverse sullo stesso tesserato.
 */
export function TabellaQuote({
  righe,
  codiceStagione,
}: {
  righe: RigaQuota[]
  codiceStagione: string
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
          <th>Tesserato</th>
          <th>Squadra</th>
          <th>Quota attesa</th>
          <th>Versato</th>
          <th>Residuo</th>
          <th>Stato</th>
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
            <td className="text-neutral-600">{r.squadra?.nome ?? '—'}</td>
            <td>
              {formattaEuro(r.quotaAttesa)}
              {/* Quale livello decide l'importo: senza, un override di squadra
                  sembra un errore di calcolo del default di stagione. */}
              <span className="ml-2 text-xs text-neutral-500">
                {ETICHETTA_LIVELLO[r.livelloImporto]}
              </span>
            </td>
            <td>{formattaEuro(r.pagato)}</td>
            <td>
              {r.residuo < 0 ? (
                // Un sovra-pagamento è un credito, non un errore.
                <span className="text-sky-800">credito {formattaEuro(-r.residuo)}</span>
              ) : (
                formattaEuro(r.residuo)
              )}
            </td>
            <td>
              <span className={`rounded px-2 py-0.5 ${COLORE_QUOTA[r.stato]}`}>
                {ETICHETTA_QUOTA[r.stato]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
