'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import { formattaData } from '@/lib/domain/data'
import type { Persona } from '@/lib/repos/persone'
import type { Squadra } from '@/lib/repos/squadre'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Il tesseramento sceglie una persona dall'anagrafica, non la reinserisce: è
 * la decisione presa contro il rollover automatico, e senza di essa lo stesso
 * ragazzo finisce in anagrafica una volta per stagione.
 */
export function FormTesseramento({
  azione,
  candidati,
  squadre,
}: {
  azione: Azione
  candidati: Persona[]
  squadre: Squadra[]
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={invia} className="space-y-4 rounded-lg border bg-white p-4">
      <fieldset>
        <legend className="text-sm font-medium">Persona da tesserare</legend>
        {campi?.personaId && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.personaId}</p>
        )}
        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {candidati.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-50">
              <input type="radio" name="personaId" value={p.id} required />
              <span className="text-sm">
                {p.cognome} {p.nome}
                <span className="ml-2 text-neutral-500">{formattaData(p.dataNascita)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col">
          <label htmlFor="squadraId" className="text-sm font-medium">Squadra</label>
          <select id="squadraId" name="squadraId" className="mt-1.5 rounded-md border px-3 text-sm">
            {/* Vuoto in cima e non in fondo: tesserare senza squadra è lo
                stato normale a inizio stagione, non l'eccezione. */}
            <option value="">Senza squadra</option>
            {squadre.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          {campi?.squadraId && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.squadraId}</p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="numeroMaglia" className="text-sm font-medium">Numero di maglia</label>
          <input
            id="numeroMaglia"
            name="numeroMaglia"
            inputMode="numeric"
            placeholder="facoltativo"
            className="mt-1.5 rounded-md border px-3 text-sm"
          />
          {campi?.numeroMaglia && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.numeroMaglia}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone"
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
