'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

export function FormSeduta({ azione, oggi }: { azione: Azione; oggi: string }) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={invia} className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <div className="flex flex-col">
        <label htmlFor="data" className="text-sm font-medium">Data</label>
        <input
          id="data"
          name="data"
          type="date"
          defaultValue={oggi}
          className="mt-1.5 rounded-md border px-3 text-sm"
        />
        {campi?.data && <p role="alert" className="mt-1 text-sm text-red-700">{campi.data}</p>}
      </div>
      <div className="flex flex-col">
        <label htmlFor="oraInizio" className="text-sm font-medium">Ora</label>
        <input id="oraInizio" name="oraInizio" type="time" className="mt-1.5 rounded-md border px-3 text-sm" />
        {campi?.oraInizio && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.oraInizio}</p>
        )}
      </div>
      <div className="flex flex-col">
        <label htmlFor="note" className="text-sm font-medium">Note</label>
        <input id="note" name="note" className="mt-1.5 rounded-md border px-3 text-sm" />
      </div>
      <button
        type="submit"
        disabled={inCorso}
        className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
      >
        {inCorso ? 'Creazione…' : 'Nuova seduta'}
      </button>
      {esito && !esito.ok && !campi && (
        <p role="alert" className="w-full text-sm text-red-700">{esito.errore}</p>
      )}
    </form>
  )
}
