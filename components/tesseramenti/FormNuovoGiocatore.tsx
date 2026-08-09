'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Giocatore nuovo, creato e tesserato dalla scheda squadra. Tre campi e non
 * dodici: il resto dell'anagrafica — codice fiscale, contatti, indirizzo — si
 * completa dalla scheda della persona, con calma. Qui conta mettere un nome in
 * rosa mentre si ha l'elenco in mano.
 *
 * Nessun numero di maglia: la società non lo usa, e un campo che nessuno legge
 * è solo una casella in più fra il nome e la rosa.
 *
 * `<details>` chiuso per default: la strada normale è cercare in anagrafica chi
 * c'è già, e un modulo di creazione sempre aperto invita a duplicare una persona
 * che esiste da tre stagioni.
 */
export function FormNuovoGiocatore({ azione }: { azione: Azione }) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <details open={Boolean(esito && !esito.ok)} className="rounded border bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Non è in anagrafica? Aggiungi un giocatore nuovo
      </summary>

      <form action={invia} className="space-y-3 border-t px-4 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col">
            <label htmlFor="nuovo-nome" className="text-sm font-medium">Nome</label>
            <input id="nuovo-nome" name="nome" required autoComplete="off"
                   className="mt-1.5 rounded-md border px-3 text-sm" />
            {campi?.nome && <p role="alert" className="mt-1 text-sm text-red-700">{campi.nome}</p>}
          </div>
          <div className="flex flex-col">
            <label htmlFor="nuovo-cognome" className="text-sm font-medium">Cognome</label>
            <input id="nuovo-cognome" name="cognome" required autoComplete="off"
                   className="mt-1.5 rounded-md border px-3 text-sm" />
            {campi?.cognome && (
              <p role="alert" className="mt-1 text-sm text-red-700">{campi.cognome}</p>
            )}
          </div>
          <div className="flex flex-col">
            <label htmlFor="nuovo-nascita" className="text-sm font-medium">
              Data di nascita
            </label>
            <input id="nuovo-nascita" name="dataNascita" type="date"
                   className="mt-1.5 rounded-md border px-3 text-sm" />
            {campi?.dataNascita && (
              <p role="alert" className="mt-1 text-sm text-red-700">{campi.dataNascita}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={inCorso} className="bottone">
            {inCorso ? 'Tesseramento…' : 'Crea e tessera'}
          </button>
          <p className="text-sm text-neutral-600">
            La persona entra in anagrafica e viene tesserata in questa squadra.
          </p>
        </div>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
      </form>
    </details>
  )
}
