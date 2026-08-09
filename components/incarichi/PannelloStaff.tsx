'use client'

import { useEffect, useActionState, useState, useTransition } from 'react'
import { RicercaPersona } from '@/components/persone/RicercaPersona'
import type { Risultato } from '@/lib/azioni'
import { RUOLI_STAFF } from '@/lib/costanti'
import type { Incarico } from '@/lib/repos/incarichi'
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
  cerca,
  aggiungi,
  rimuovi,
  modificabile,
}: {
  incarichi: Incarico[]
  cerca: (testo: string) => Promise<Risultato<Persona[]>>
  aggiungi: Azione
  rimuovi: (id: string) => Promise<Risultato<null>>
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(aggiungi, null)
  const [scelta, setScelta] = useState<Persona | null>(null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  // Azzerare la scelta a operazione riuscita non è cosmetico: finché il nome
  // resta selezionato l'autocomplete mostra il riquadro giallo invece del campo,
  // e chi sta aggiungendo dieci persone di fila deve premere "Cambia" ogni volta.
  useEffect(() => {
    if (esito?.ok) setScelta(null)
  }, [esito])
  const [erroreRimozione, setErroreRimozione] = useState<string | null>(null)
  const [rimozioneInCorso, avviaRimozione] = useTransition()

  return (
    <div className="space-y-3">
      {incarichi.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">
          Nessuno staff assegnato a questa squadra.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
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

      {modificabile && (
        <form action={invia} className="space-y-3 rounded-lg border bg-white p-4">
          <p className="text-sm font-medium">Aggiungi allo staff</p>
          <RicercaPersona
            cerca={cerca}
            etichetta="Cerca in anagrafica"
            scelta={scelta}
            onScelta={setScelta}
          />
          {scelta && <input type="hidden" name="personaId" value={scelta.id} />}
          {campi?.personaId && (
            <p role="alert" className="text-sm text-red-700">{campi.personaId}</p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label htmlFor="ruolo" className="text-sm font-medium">Ruolo</label>
              <select id="ruolo" name="ruolo" className="mt-1.5 rounded-md border px-3 text-sm">
                {RUOLI_STAFF.map((r) => (
                  <option key={r.valore} value={r.valore}>{r.etichetta}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={inCorso || !scelta} className="bottone">
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
