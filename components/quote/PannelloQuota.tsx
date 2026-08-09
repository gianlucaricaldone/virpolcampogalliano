'use client'

import { useActionState, useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import { formattaEuro } from '@/lib/domain/denaro'
import type { Pagamento, RigaQuota } from '@/lib/repos/quote'
import { METODI } from '@/lib/costanti'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

const ETICHETTA_METODO: Record<string, string> = Object.fromEntries(
  METODI.map((m) => [m.valore, m.etichetta]),
)

export function PannelloQuota({
  quota,
  pagamenti,
  registra,
  annulla,
  oggi,
  modificabile,
}: {
  quota: RigaQuota
  pagamenti: Pagamento[]
  registra: Azione
  annulla: (pagamentoId: string) => Promise<Risultato<null>>
  oggi: string
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(registra, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [importo, setImporto] = useState('')
  const [erroreAnnullo, setErroreAnnullo] = useState<string | null>(null)
  const [annulloInCorso, avviaAnnullo] = useTransition()

  // "Metà" non è un caso speciale del modello: è un versamento di importo
  // pari a metà, e il pulsante si limita a precompilare il campo.
  const meta = quota.quotaAttesa > 0 ? (quota.quotaAttesa / 2).toFixed(2) : ''
  const residuo = quota.residuo > 0 ? quota.residuo.toFixed(2) : ''

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <dl className="grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Quota attesa</dt>
          <dd>{formattaEuro(quota.quotaAttesa)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Versato</dt>
          <dd>{formattaEuro(quota.pagato)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            {quota.residuo < 0 ? 'Credito' : 'Residuo'}
          </dt>
          <dd>{formattaEuro(Math.abs(quota.residuo))}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Stato</dt>
          <dd>{quota.stato.replace('_', ' ')}</dd>
        </div>
      </dl>

      {pagamenti.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {pagamenti.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span>
                <strong>{formattaEuro(p.importo)}</strong>
                <span className="ml-2 text-neutral-600">
                  {p.data} · {ETICHETTA_METODO[p.metodo] ?? p.metodo}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
              {modificabile && (
                <button
                  type="button"
                  disabled={annulloInCorso}
                  onClick={() => {
                    setErroreAnnullo(null)
                    avviaAnnullo(async () => {
                      const risultato = await annulla(p.id)
                      if (!risultato.ok) setErroreAnnullo(risultato.errore)
                    })
                  }}
                  className="text-red-700 underline disabled:opacity-60"
                >
                  Annulla
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {erroreAnnullo && <p role="alert" className="text-sm text-red-700">{erroreAnnullo}</p>}

      {modificabile && (
        <form action={invia} className="space-y-3 border-t pt-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="flex flex-col">
              <label htmlFor="importo" className="text-sm font-medium">Importo</label>
              <input
                id="importo"
                name="importo"
                inputMode="decimal"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                className="mt-1.5 rounded-md border px-3 text-sm"
              />
              {campi?.importo && (
                <p role="alert" className="mt-1 text-sm text-red-700">{campi.importo}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="data" className="text-sm font-medium">Data</label>
              <input
                id="data"
                name="data"
                type="date"
                defaultValue={oggi}
                className="mt-1.5 rounded-md border px-3 text-sm"
              />
              {campi?.data && (
                <p role="alert" className="mt-1 text-sm text-red-700">{campi.data}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="metodo" className="text-sm font-medium">Metodo</label>
              <select id="metodo" name="metodo" className="mt-1.5 rounded-md border px-3 text-sm">
                {METODI.map((m) => (
                  <option key={m.valore} value={m.valore}>{m.etichetta}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="note" className="text-sm font-medium">Note</label>
              <input id="note" name="note" className="mt-1.5 rounded-md border px-3 text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={inCorso}
              className="bottone"
            >
              {inCorso ? 'Registrazione…' : 'Registra versamento'}
            </button>
            {meta && (
              <button
                type="button"
                onClick={() => setImporto(meta)}
                className="min-h-10 rounded-md border px-4 text-sm hover:bg-neutral-50"
              >
                Metà quota ({formattaEuro(Number(meta))})
              </button>
            )}
            {residuo && (
              <button
                type="button"
                onClick={() => setImporto(residuo)}
                className="min-h-10 rounded-md border px-4 text-sm hover:bg-neutral-50"
              >
                Saldo ({formattaEuro(Number(residuo))})
              </button>
            )}
            {esito?.ok && <p className="text-sm text-green-700">Registrato</p>}
            {esito && !esito.ok && !campi && (
              <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
