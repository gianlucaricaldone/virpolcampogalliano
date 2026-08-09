'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Non ha il campo squadra: la squadra è quella della pagina e la mette
 * l'azione, dall'URL. Il numero di maglia resta facoltativo — una rosa si
 * compone prima e si numera dopo.
 */
export function FormTesseraInSquadra({
  candidati,
  azione,
}: {
  candidati: Persona[]
  azione: Azione
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={invia} className="space-y-3 rounded-lg border bg-white p-4">
      <fieldset>
        <legend className="text-sm font-medium">Tessera in questa squadra</legend>
        {campi?.personaId && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.personaId}</p>
        )}
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {candidati.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-50">
              <input type="radio" name="personaId" value={p.id} required />
              <span className="text-sm">{p.cognome} {p.nome}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label htmlFor="numeroMaglia" className="text-sm font-medium">
            Numero di maglia
          </label>
          <input
            id="numeroMaglia"
            name="numeroMaglia"
            type="number"
            min={1}
            max={99}
            inputMode="numeric"
            className="mt-1.5 w-28 rounded-md border px-3 text-sm"
          />
          {campi?.numeroMaglia && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.numeroMaglia}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={inCorso}
          className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {inCorso ? 'Tesseramento…' : 'Tessera'}
        </button>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
      </div>
    </form>
  )
}
