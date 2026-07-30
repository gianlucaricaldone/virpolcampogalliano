'use client'

import { useActionState, useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import { RUOLI_STAFF, type Incarico } from '@/lib/repos/incarichi'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

function etichettaRuolo(ruolo: string): string {
  return RUOLI_STAFF.find((r) => r.valore === ruolo)?.etichetta ?? ruolo
}

export function PannelloStaff({
  incarichi,
  candidati,
  aggiungi,
  rimuovi,
  modificabile,
}: {
  incarichi: Incarico[]
  candidati: Persona[]
  aggiungi: Azione
  rimuovi: (id: string) => Promise<Risultato<null>>
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(aggiungi, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [erroreRimozione, setErroreRimozione] = useState<string | null>(null)
  const [rimozioneInCorso, avviaRimozione] = useTransition()

  return (
    <div className="space-y-3">
      {incarichi.length === 0 ? (
        <p className="rounded border bg-white p-4 text-neutral-600">
          Nessuno staff assegnato a questa squadra.
        </p>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {incarichi.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <span>
                <strong>{i.persona.cognome} {i.persona.nome}</strong>
                <span className="ml-2 text-neutral-600">{etichettaRuolo(i.ruolo)}</span>
              </span>
              {modificabile && (
                <button
                  type="button"
                  disabled={rimozioneInCorso}
                  onClick={() => {
                    setErroreRimozione(null)
                    avviaRimozione(async () => {
                      const risultato = await rimuovi(i.id)
                      if (!risultato.ok) setErroreRimozione(risultato.errore)
                    })
                  }}
                  className="text-red-700 underline disabled:opacity-60"
                >
                  Rimuovi
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {erroreRimozione && <p role="alert" className="text-sm text-red-700">{erroreRimozione}</p>}

      {modificabile && candidati.length > 0 && (
        <form action={invia} className="space-y-3 rounded border bg-white p-4">
          <fieldset>
            <legend className="text-sm font-medium">Aggiungi allo staff</legend>
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
              <label htmlFor="ruolo" className="text-sm font-medium">Ruolo</label>
              <select id="ruolo" name="ruolo" className="mt-1 rounded border px-2 py-1">
                {RUOLI_STAFF.map((r) => (
                  <option key={r.valore} value={r.valore}>{r.etichetta}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inCorso}
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {inCorso ? 'Aggiunta…' : 'Aggiungi'}
            </button>
            {esito && !esito.ok && !campi && (
              <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
