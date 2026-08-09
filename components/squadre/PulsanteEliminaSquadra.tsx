'use client'

import { useState, useTransition } from 'react'
import { eliminaSquadraAzione } from '@/app/(app)/[stagione]/squadre/actions'

/**
 * Conferma in due passi, con l'elenco delle conseguenze scritto per esteso.
 * Cancellare una squadra porta via sedute, presenze e incarichi per cascade e
 * lascia i tesserati senza squadra: il database lo fa in silenzio, quindi
 * l'unico posto dove può essere detto è qui, prima del click.
 */
export function PulsanteEliminaSquadra({
  codiceStagione,
  id,
  nome,
}: {
  codiceStagione: string
  id: string
  nome: string
}) {
  const [conferma, setConferma] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  if (!conferma) {
    return (
      <button
        type="button"
        onClick={() => setConferma(true)}
        className="bottone-pericolo"
      >
        Elimina squadra
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded border border-red-300 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        Eliminando <strong>{nome}</strong> spariscono anche le sue sedute di allenamento e le
        presenze già registrate, e gli incarichi di staff su questa squadra. I tesserati restano
        iscritti alla stagione, ma senza squadra.
      </p>
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setErrore(null)
            avvia(async () => {
              // In caso di successo l'azione reindirizza e questa riga non
              // viene mai raggiunta; serve per i fallimenti previsti.
              const esito = await eliminaSquadraAzione(codiceStagione, id)
              if (!esito.ok) setErrore(esito.errore)
            })
          }}
          className="bottone-pericolo-forte"
        >
          {inCorso ? 'Eliminazione…' : 'Elimina definitivamente'}
        </button>
        <button
          type="button"
          onClick={() => setConferma(false)}
          className="bottone-secondario"
        >
          Annulla
        </button>
      </div>
    </div>
  )
}
