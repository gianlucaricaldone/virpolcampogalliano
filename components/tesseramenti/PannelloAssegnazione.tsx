'use client'

import { useActionState, useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Squadra } from '@/lib/repos/squadre'
import type { Tesserato } from '@/lib/repos/tesseramenti'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

export function PannelloAssegnazione({
  azione,
  rimuovi,
  tesserato,
  squadre,
}: {
  azione: Azione
  rimuovi: () => Promise<Risultato<null>>
  tesserato: Tesserato
  squadre: Squadra[]
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [conferma, setConferma] = useState(false)
  const [erroreRimozione, setErroreRimozione] = useState<string | null>(null)
  const [rimozioneInCorso, avviaRimozione] = useTransition()

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4">
      <form action={invia} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="squadraId" className="text-sm font-medium">Squadra</label>
            <select
              id="squadraId"
              name="squadraId"
              defaultValue={tesserato.squadra?.id ?? ''}
              className="mt-1.5 rounded-md border px-3 text-sm"
            >
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
              defaultValue={tesserato.numeroMaglia ?? ''}
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
            className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {inCorso ? 'Salvataggio…' : 'Salva assegnazione'}
          </button>
          {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
          {esito && !esito.ok && !campi && (
            <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
          )}
        </div>
      </form>

      <div className="border-t pt-3">
        {conferma ? (
          <div className="space-y-2">
            <p className="text-sm text-red-900">
              Il tesseramento sparisce da questa stagione, insieme alle presenze e ai versamenti
              collegati. La persona resta in anagrafica con lo storico delle altre stagioni.
            </p>
            {erroreRimozione && (
              <p role="alert" className="text-sm text-red-700">{erroreRimozione}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={rimozioneInCorso}
                onClick={() => {
                  setErroreRimozione(null)
                  avviaRimozione(async () => {
                    // In caso di successo l'azione reindirizza: questa riga
                    // serve solo ai fallimenti previsti.
                    const risultato = await rimuovi()
                    if (!risultato.ok) setErroreRimozione(risultato.errore)
                  })
                }}
                className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {rimozioneInCorso ? 'Rimozione…' : 'Rimuovi definitivamente'}
              </button>
              <button
                type="button"
                onClick={() => setConferma(false)}
                className="min-h-10 rounded-md border px-4 text-sm hover:bg-neutral-50"
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConferma(true)}
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
          >
            Rimuovi il tesseramento
          </button>
        )}
      </div>
    </div>
  )
}
