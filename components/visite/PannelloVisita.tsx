'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import { COLORE_VISITA, descrizioneVisita } from '@/lib/domain/visita'
import type { RigaVisita } from '@/lib/repos/visite'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Lo stato non si calcola qui: arriva da `v_visite`. Questo pannello mostra la
 * frase e permette di scrivere le due date.
 */
export function PannelloVisita({
  visita,
  azione,
  modificabile,
}: {
  visita: RigaVisita
  azione: Azione
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <div className="space-y-3 rounded border bg-white p-4">
      <p>
        <span className={`rounded px-2 py-0.5 text-sm ${COLORE_VISITA[visita.stato]}`}>
          {descrizioneVisita(visita)}
        </span>
      </p>

      {modificabile ? (
        <form action={invia} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label htmlFor="scadenza" className="text-sm font-medium">Scadenza</label>
            <input
              id="scadenza"
              name="scadenza"
              type="date"
              defaultValue={visita.scadenza ?? ''}
              className="mt-1 rounded border px-2 py-1"
            />
            {campi?.scadenza && (
              <p role="alert" className="mt-1 text-sm text-red-700">{campi.scadenza}</p>
            )}
          </div>
          <div className="flex flex-col">
            <label htmlFor="consegnataIl" className="text-sm font-medium">
              Consegnata il
            </label>
            <input
              id="consegnataIl"
              name="consegnataIl"
              type="date"
              defaultValue={visita.consegnataIl ?? ''}
              className="mt-1 rounded border px-2 py-1"
            />
            {/* Informativa: lo stato dipende solo dalla scadenza, perché i dati
                storici da migrare non hanno la data di consegna. */}
            <p className="mt-1 text-xs text-neutral-500">Non incide sullo stato</p>
          </div>
          <button
            type="submit"
            disabled={inCorso}
            className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {inCorso ? 'Salvataggio…' : 'Salva visita'}
          </button>
          {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
          {esito && !esito.ok && !campi && (
            <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
          )}
        </form>
      ) : (
        <p className="text-sm text-neutral-600">
          Il certificato non si carica come file: è un dato sanitario, e
          conservarlo richiede un archivio protetto che questa applicazione non ha.
        </p>
      )}
    </div>
  )
}
