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
 *
 * La griglia a colonne fisse è il motivo per cui le righe si leggono come una
 * tabella pur essendo dodici form distinti — uno per livello, perché ognuno si
 * salva da sé. Prima ogni riga impilava etichetta, campo e pulsante a larghezza
 * piena: dodici blocchi identici alti come un paragrafo, con tutta la metà
 * destra vuota, e nessun modo di confrontare a occhio quali squadre avessero un
 * importo proprio.
 */
export function RigaImporto({
  etichetta,
  valore,
  ereditato,
  azione,
  rimuovi,
  modificabile,
  evidenziata = false,
}: {
  etichetta: string
  valore: number | null
  ereditato?: { importo: number; da: string } | null
  azione: Azione
  rimuovi?: () => Promise<Risultato<null>>
  modificabile: boolean
  evidenziata?: boolean
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [erroreRimozione, setErroreRimozione] = useState<string | null>(null)
  const [rimozioneInCorso, avviaRimozione] = useTransition()

  const fondo = evidenziata ? 'bg-neutral-50' : ''

  if (!modificabile) {
    return (
      <div className={`grid grid-cols-[1fr_auto] items-baseline gap-3 border-t px-3 py-2 text-sm ${fondo}`}>
        <span className={evidenziata ? 'font-medium' : ''}>{etichetta}</span>
        <span className="text-neutral-600">
          {valore !== null ? formattaEuro(valore) : '—'}
        </span>
      </div>
    )
  }

  return (
    <form
      action={invia}
      className={`grid items-center gap-x-3 gap-y-1 border-t px-3 py-2 sm:grid-cols-[minmax(8rem,16rem)_8rem_auto_1fr] ${fondo}`}
    >
      <label
        htmlFor={`importo-${etichetta}`}
        className={`text-sm ${evidenziata ? 'font-semibold' : 'font-medium'}`}
      >
        {etichetta}
      </label>
      <input
        id={`importo-${etichetta}`}
        name="importo"
        inputMode="decimal"
        defaultValue={valore ?? ''}
        placeholder={ereditato ? formattaEuro(ereditato.importo) : 'nessuno'}
        aria-describedby={ereditato ? `ereditato-${etichetta}` : undefined}
        className="w-full rounded-md border px-3 text-sm"
      />
      <button type="submit" disabled={inCorso} className="bottone-secondario">
        {inCorso ? '…' : 'Salva'}
      </button>

      {/* L'ultima colonna porta, in ordine di importanza, l'errore, la conferma,
          la provenienza dell'importo ereditato e il modo di togliere l'override:
          una colonna sola, così le righe restano tutte alte uguale. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {(campi?.importo || (esito && !esito.ok && !campi)) && (
          <p role="alert" className="text-red-700">
            {campi?.importo ?? (esito && !esito.ok ? esito.errore : '')}
          </p>
        )}
        {erroreRimozione && <p role="alert" className="text-red-700">{erroreRimozione}</p>}
        {esito?.ok && <p className="text-green-700">Salvato</p>}
        {valore === null && ereditato && (
          <span id={`ereditato-${etichetta}`} className="text-neutral-500">
            ereditato da {ereditato.da}
          </span>
        )}
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
            className="text-red-700 underline disabled:opacity-60"
          >
            Togli l&apos;override
          </button>
        )}
      </div>
    </form>
  )
}
