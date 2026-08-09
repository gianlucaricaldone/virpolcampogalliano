'use client'

import { useState, useTransition } from 'react'
import { cambiaArchiviazioneAzione } from '@/app/(app)/anagrafica/actions'

export function PulsanteArchiviazione({ id, attiva }: { id: string; attiva: boolean }) {
  const [inCorso, avvia] = useTransition()
  const [errore, setErrore] = useState<string | null>(null)

  function cambia() {
    setErrore(null)
    avvia(async () => {
      // Il risultato va letto: senza, un { ok: false } riattiva solo il
      // pulsante, revalidatePath non scatta e la scheda resta com'era —
      // indistinguibile da un click andato a vuoto.
      const esito = await cambiaArchiviazioneAzione(id, attiva)
      if (!esito.ok) setErrore(esito.errore)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={cambia}
        disabled={inCorso}
        className="bottone-secondario"
      >
        {attiva ? 'Archivia' : 'Riattiva'}
      </button>
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
    </div>
  )
}
