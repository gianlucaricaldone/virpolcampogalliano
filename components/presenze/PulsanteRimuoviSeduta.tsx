'use client'

import { useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'

export function PulsanteRimuoviSeduta({ azione }: { azione: () => Promise<Risultato<null>> }) {
  const [conferma, setConferma] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  if (!conferma) {
    return (
      <button
        type="button"
        onClick={() => setConferma(true)}
        className="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
      >
        Elimina la seduta
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded border border-red-300 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        Spariscono anche le presenze già registrate per questa seduta, e le percentuali
        cambieranno di conseguenza: la seduta smette di contare nel denominatore.
      </p>
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setErrore(null)
            avvia(async () => {
              // In caso di successo l'azione reindirizza: questa riga serve
              // solo ai fallimenti previsti.
              const esito = await azione()
              if (!esito.ok) setErrore(esito.errore)
            })
          }}
          className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {inCorso ? 'Eliminazione…' : 'Elimina definitivamente'}
        </button>
        <button
          type="button"
          onClick={() => setConferma(false)}
          className="rounded border px-3 py-2 text-sm"
        >
          Annulla
        </button>
      </div>
    </div>
  )
}
