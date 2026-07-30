import Link from 'next/link'
import { formattaEuro } from '@/lib/domain/denaro'
import type { LivelloImporto, RigaQuota } from '@/lib/repos/quote'

const ETICHETTA_STATO: Record<string, string> = {
  non_pagato: 'non pagato',
  parziale: 'parziale',
  saldato: 'saldato',
}

const COLORE_STATO: Record<string, string> = {
  non_pagato: 'bg-red-100 text-red-900',
  parziale: 'bg-amber-100 text-amber-900',
  saldato: 'bg-green-100 text-green-900',
}

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
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessun tesserato corrisponde a questi filtri.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Tesserato</th>
          <th className="p-2">Squadra</th>
          <th className="p-2">Quota attesa</th>
          <th className="p-2">Versato</th>
          <th className="p-2">Residuo</th>
          <th className="p-2">Stato</th>
        </tr>
      </thead>
      <tbody>
        {righe.map((r) => (
          <tr key={r.tesseramentoId} className="border-t">
            <td className="p-2 font-medium">
              <Link
                href={`/${codiceStagione}/tesseramenti/${r.tesseramentoId}`}
                className="underline"
              >
                {r.persona.cognome} {r.persona.nome}
              </Link>
            </td>
            <td className="p-2 text-neutral-600">{r.squadra?.nome ?? '—'}</td>
            <td className="p-2">
              {formattaEuro(r.quotaAttesa)}
              {/* Quale livello decide l'importo: senza, un override di squadra
                  sembra un errore di calcolo del default di stagione. */}
              <span className="ml-2 text-xs text-neutral-500">
                {ETICHETTA_LIVELLO[r.livelloImporto]}
              </span>
            </td>
            <td className="p-2">{formattaEuro(r.pagato)}</td>
            <td className="p-2">
              {r.residuo < 0 ? (
                // Un sovra-pagamento è un credito, non un errore.
                <span className="text-sky-800">credito {formattaEuro(-r.residuo)}</span>
              ) : (
                formattaEuro(r.residuo)
              )}
            </td>
            <td className="p-2">
              <span className={`rounded px-2 py-0.5 ${COLORE_STATO[r.stato]}`}>
                {ETICHETTA_STATO[r.stato]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
