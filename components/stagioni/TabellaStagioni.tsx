'use client'

import { useTransition } from 'react'
import { cambiaStatoAzione } from '@/app/(app)/admin/stagioni/actions'
import type { Stagione } from '@/lib/repos/stagioni'

export function TabellaStagioni({ stagioni }: { stagioni: Stagione[] }) {
  const [inCorso, avvia] = useTransition()

  if (stagioni.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna stagione: creane una per iniziare.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Stagione</th>
          <th className="p-2">Periodo</th>
          <th className="p-2">Stato</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {stagioni.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="p-2 font-medium">{s.etichetta}</td>
            <td className="p-2 text-neutral-600">{s.dataInizio} → {s.dataFine}</td>
            <td className="p-2">{s.stato}</td>
            <td className="p-2 text-right">
              <button
                type="button"
                disabled={inCorso}
                onClick={() => avvia(() => {
                  void cambiaStatoAzione(s.id, s.stato === 'aperta' ? 'chiusa' : 'aperta')
                })}
                className="underline disabled:opacity-60"
              >
                {s.stato === 'aperta' ? 'Chiudi' : 'Riapri'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
