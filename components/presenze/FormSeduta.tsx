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
    <form action={invia} className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
      <div className="flex flex-col">
        <label htmlFor="data" className="text-sm font-medium">Data</label>
        <input
          id="data"
          name="data"
          type="date"
          defaultValue={oggi}
          className="mt-1 rounded border px-2 py-1"
        />
        {campi?.data && <p role="alert" className="mt-1 text-sm text-red-700">{campi.data}</p>}
      </div>
      <div className="flex flex-col">
        <label htmlFor="oraInizio" className="text-sm font-medium">Ora</label>
        <input id="oraInizio" name="oraInizio" type="time" className="mt-1 rounded border px-2 py-1" />
        {campi?.oraInizio && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.oraInizio}</p>
        )}
      </div>
      <div className="flex flex-col">
        <label htmlFor="note" className="text-sm font-medium">Note</label>
        <input id="note" name="note" className="mt-1 rounded border px-2 py-1" />
      </div>
      <button
        type="submit"
        disabled={inCorso}
        className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60"
      >
        {inCorso ? 'Creazione…' : 'Nuova seduta'}
      </button>
      {esito && !esito.ok && !campi && (
        <p role="alert" className="w-full text-sm text-red-700">{esito.errore}</p>
      )}
    </form>
  )
}
