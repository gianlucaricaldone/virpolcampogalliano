'use client'

import { useActionState, useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import { formattaEuro } from '@/lib/domain/denaro'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Un livello di importo: stagione, squadra o singolo tesserato.
 *
 * `ereditato` è l'importo che varrebbe senza questo override, e si mostra
 * accanto al campo vuoto: senza, chi apre la riga di una squadra non sa da
 * quale cifra sta partendo e ne inserisce una a caso.
 */
export function RigaImporto({
  etichetta,
  valore,
  ereditato,
  azione,
  rimuovi,
  modificabile,
}: {
  etichetta: string
  valore: number | null
  ereditato?: { importo: number; da: string } | null
  azione: Azione
  rimuovi?: () => Promise<Risultato<null>>
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [erroreRimozione, setErroreRimozione] = useState<string | null>(null)
  const [rimozioneInCorso, avviaRimozione] = useTransition()

  if (!modificabile) {
    return (
      <div className="flex items-baseline justify-between gap-3 border-t p-2 text-sm">
        <span>{etichetta}</span>
        <span className="text-neutral-600">
          {valore !== null ? formattaEuro(valore) : '—'}
        </span>
      </div>
    )
  }

  return (
    <form action={invia} className="flex flex-wrap items-end gap-3 border-t p-2">
      <div className="flex flex-col">
        <label htmlFor={`importo-${etichetta}`} className="text-sm font-medium">
          {etichetta}
        </label>
        <input
          id={`importo-${etichetta}`}
          name="importo"
          inputMode="decimal"
          defaultValue={valore ?? ''}
          placeholder={
            ereditato ? `${formattaEuro(ereditato.importo)} da ${ereditato.da}` : 'nessun importo'
          }
          className="mt-1.5 w-40 rounded-md border px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={inCorso}
        className="min-h-10 rounded-md border px-4 text-sm hover:bg-neutral-50 disabled:opacity-60"
      >
        {inCorso ? 'Salvataggio…' : 'Salva'}
      </button>
      {rimuovi && valore !== null && (
        <button
          type="button"
          disabled={rimozioneInCorso}
          onClick={() => {
            setErroreRimozione(null)
            avviaRimozione(async () => {
              const risultato = await rimuovi()
              if (!risultato.ok) setErroreRimozione(risultato.errore)
            })
          }}
          className="text-sm text-red-700 underline disabled:opacity-60"
        >
          Togli l&apos;override
        </button>
      )}
      {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
      {(campi?.importo || (esito && !esito.ok && !campi)) && (
        <p role="alert" className="text-sm text-red-700">
          {campi?.importo ?? (esito && !esito.ok ? esito.errore : '')}
        </p>
      )}
      {erroreRimozione && <p role="alert" className="text-sm text-red-700">{erroreRimozione}</p>}
    </form>
  )
}
