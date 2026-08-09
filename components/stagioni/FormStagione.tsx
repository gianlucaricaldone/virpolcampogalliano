'use client'

import { useActionState } from 'react'
import { creaStagioneAzione } from '@/app/(app)/admin/stagioni/actions'

export function FormStagione() {
  const [esito, azione, inCorso] = useActionState(creaStagioneAzione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={azione} className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <div>
        <label htmlFor="codice" className="block text-sm font-medium">Codice</label>
        <input id="codice" name="codice" placeholder="2026-27" required
               className="mt-1.5 rounded-md border px-3 text-sm" />
        {campi?.codice && <p role="alert" className="mt-1 text-sm text-red-700">{campi.codice}</p>}
      </div>
      <div>
        <label htmlFor="dataInizio" className="block text-sm font-medium">Inizio</label>
        <input id="dataInizio" name="dataInizio" type="date" required
               className="mt-1.5 rounded-md border px-3 text-sm" />
        {campi?.dataInizio && <p role="alert" className="mt-1 text-sm text-red-700">{campi.dataInizio}</p>}
      </div>
      <div>
        <label htmlFor="dataFine" className="block text-sm font-medium">Fine</label>
        <input id="dataFine" name="dataFine" type="date" required
               className="mt-1.5 rounded-md border px-3 text-sm" />
        {campi?.dataFine && <p role="alert" className="mt-1 text-sm text-red-700">{campi.dataFine}</p>}
      </div>
      <button type="submit" disabled={inCorso}
              className="bottone">
        {inCorso ? 'Creazione…' : 'Crea stagione'}
      </button>
      {esito && !esito.ok && !campi && (
        <p role="alert" className="w-full text-sm text-red-700">{esito.errore}</p>
      )}
    </form>
  )
}
