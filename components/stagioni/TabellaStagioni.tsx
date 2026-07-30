'use client'

import { useState, useTransition } from 'react'
import { cambiaStatoAzione } from '@/app/(app)/admin/stagioni/actions'
import type { Stagione } from '@/lib/repos/stagioni'
import { Tabella } from '../ui/Tabella'

export function TabellaStagioni({ stagioni }: { stagioni: Stagione[] }) {
  const [inCorso, avvia] = useTransition()
  const [errore, setErrore] = useState<string | null>(null)

  if (stagioni.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna stagione: creane una per iniziare.
      </p>
    )
  }

  function cambiaStato(s: Stagione) {
    setErrore(null)
    avvia(async () => {
      // Il risultato va controllato: senza, un { ok: false } (es. un admin
      // disattivato in un'altra scheda) fa solo riattivare il pulsante,
      // revalidatePath non scatta e la riga resta com'era — sembra che il
      // click non abbia fatto nulla.
      const esito = await cambiaStatoAzione(s.id, s.stato === 'aperta' ? 'chiusa' : 'aperta')
      if (!esito.ok) setErrore(esito.errore)
    })
  }

  return (
    <div className="space-y-2">
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
      <Tabella>
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
                  onClick={() => cambiaStato(s)}
                  className="underline disabled:opacity-60"
                >
                  {s.stato === 'aperta' ? 'Chiudi' : 'Riapri'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Tabella>
    </div>
  )
}
