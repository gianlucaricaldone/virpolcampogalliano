'use client'

import { useOptimistic, useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import { STATI_PRESENZA } from '@/lib/costanti'
import type { RigaPresenza, StatoPresenza } from '@/lib/repos/presenze'

type Modifica = { tesseramentoId: string; stato: StatoPresenza | null }

/**
 * L'unica schermata davvero interattiva del piano.
 *
 * La spunta appare subito (`useOptimistic`) e torna indietro da sola quando la
 * transizione finisce senza che il dato sul server sia cambiato. Il ritorno
 * indietro da solo non basta però: senza un avviso visibile, una spunta che
 * sparisce sembra un click andato a vuoto, e chi compila riprova invece di
 * capire che il salvataggio è fallito. Le due cose insieme sono il requisito.
 */
export function FoglioPresenze({
  righe,
  salva,
  modificabile,
}: {
  righe: RigaPresenza[]
  salva: (modifiche: Modifica[]) => Promise<Risultato<null>>
  modificabile: boolean
}) {
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()
  const [ottimistiche, applica] = useOptimistic(
    righe,
    (stato: RigaPresenza[], modifiche: Modifica[]) => {
      const perId = new Map(modifiche.map((m) => [m.tesseramentoId, m.stato]))
      return stato.map((r) =>
        perId.has(r.tesseramentoId) ? { ...r, stato: perId.get(r.tesseramentoId)! } : r,
      )
    },
  )

  function invia(modifiche: Modifica[]) {
    setErrore(null)
    avvia(async () => {
      applica(modifiche)
      const esito = await salva(modifiche)
      if (!esito.ok) setErrore(esito.errore)
    })
  }

  const compilate = ottimistiche.filter((r) => r.stato !== null).length

  return (
    <div className="space-y-3">
      {errore && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {errore} — le spunte sono tornate come prima: nulla è stato salvato.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {compilate} di {ottimistiche.length} compilate
        </p>
        {modificabile && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={inCorso}
              onClick={() =>
                invia(ottimistiche.map((r) => ({ tesseramentoId: r.tesseramentoId, stato: 'presente' as const })))
              }
              className="rounded border px-3 py-2 text-sm disabled:opacity-60"
            >
              Tutti presenti
            </button>
            <button
              type="button"
              disabled={inCorso}
              onClick={() =>
                invia(ottimistiche.map((r) => ({ tesseramentoId: r.tesseramentoId, stato: null })))
              }
              className="rounded border px-3 py-2 text-sm disabled:opacity-60"
            >
              Svuota
            </button>
          </div>
        )}
      </div>

      <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
        <thead className="bg-neutral-100 text-left">
          <tr>
            <th className="p-2">Giocatore</th>
            <th className="p-2">Maglia</th>
            <th className="p-2">Stato</th>
          </tr>
        </thead>
        <tbody>
          {ottimistiche.map((r) => (
            <tr key={r.tesseramentoId} className="border-t">
              <td className="p-2 font-medium">{r.cognome} {r.nome}</td>
              <td className="p-2 text-neutral-600">{r.numeroMaglia ?? '—'}</td>
              <td className="p-2">
                {modificabile ? (
                  <div className="flex flex-wrap gap-1">
                    {STATI_PRESENZA.map((s) => (
                      <button
                        key={s.valore}
                        type="button"
                        aria-pressed={r.stato === s.valore}
                        aria-label={`${s.etichetta}: ${r.cognome} ${r.nome}`}
                        disabled={inCorso}
                        onClick={() =>
                          invia([
                            {
                              tesseramentoId: r.tesseramentoId,
                              // Ripremere lo stesso stato lo toglie: è il modo
                              // di correggere una spunta senza cancellare la
                              // riga da un'altra parte.
                              stato: r.stato === s.valore ? null : s.valore,
                            },
                          ])
                        }
                        className={`rounded border px-2 py-1 disabled:opacity-60 ${
                          r.stato === s.valore ? 'bg-neutral-900 text-white' : 'bg-white'
                        }`}
                        title={s.etichetta}
                      >
                        {s.breve}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-neutral-600">
                    {STATI_PRESENZA.find((s) => s.valore === r.stato)?.etichetta ?? 'non compilato'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
