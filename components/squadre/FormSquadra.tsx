'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Squadra } from '@/lib/repos/squadre'
import { CATEGORIE } from '@/lib/costanti'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

export function FormSquadra({
  azione,
  squadra,
  etichettaInvio,
}: {
  azione: Azione
  squadra?: Squadra
  etichettaInvio: string
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={invia} className="space-y-4 rounded-lg border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col">
          <label htmlFor="nome" className="text-sm font-medium">Nome</label>
          <input
            id="nome"
            name="nome"
            required
            defaultValue={squadra?.nome ?? ''}
            placeholder="Pulcini A"
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
          {campi?.nome && <p role="alert" className="mt-1 text-sm text-red-700">{campi.nome}</p>}
        </div>

        <div className="flex flex-col">
          <label htmlFor="categoria" className="text-sm font-medium">Categoria</label>
          {/* Datalist e non select: la colonna è testo libero, e una società
              può usare una categoria che la lista non prevede. */}
          <input
            id="categoria"
            name="categoria"
            required
            list="categorie"
            defaultValue={squadra?.categoria ?? ''}
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
          <datalist id="categorie">
            {CATEGORIE.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {campi?.categoria && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.categoria}</p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="annata" className="text-sm font-medium">Annata</label>
          <input
            id="annata"
            name="annata"
            inputMode="numeric"
            defaultValue={squadra?.annata ?? ''}
            placeholder="2015"
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
          {campi?.annata && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.annata}</p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="note" className="text-sm font-medium">Note</label>
          <input
            id="note"
            name="note"
            defaultValue={squadra?.note ?? ''}
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone"
        >
          {inCorso ? 'Salvataggio…' : etichettaInvio}
        </button>
        {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
      </div>
    </form>
  )
}
