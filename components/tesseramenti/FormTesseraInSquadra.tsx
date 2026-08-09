'use client'

import { useEffect, useActionState, useState } from 'react'
import { RicercaPersona } from '@/components/persone/RicercaPersona'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Tessera in questa squadra una persona già in anagrafica. Due soli gesti:
 * scrivere due lettere del cognome e scegliere dall'elenco che si apre.
 *
 * Nessun campo per il numero di maglia: la società non lo usa. Restava nel
 * form perché la colonna esiste nello schema, che è il modo tipico di far
 * compilare a qualcuno un dato che nessuno leggerà.
 *
 * `personaId` viaggia in un campo nascosto invece che in un radio button: la
 * scelta ora è una sola, e la lista dei candidati non è più nel form.
 */
export function FormTesseraInSquadra({
  cerca,
  azione,
}: {
  cerca: (testo: string) => Promise<Risultato<Persona[]>>
  azione: Azione
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const [scelta, setScelta] = useState<Persona | null>(null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  // Azzerare la scelta a operazione riuscita non è cosmetico: finché il nome
  // resta selezionato l'autocomplete mostra il riquadro giallo invece del campo,
  // e chi sta aggiungendo dieci persone di fila deve premere "Cambia" ogni volta.
  useEffect(() => {
    if (esito?.ok) setScelta(null)
  }, [esito])

  return (
    <form action={invia} className="space-y-3 rounded-lg border bg-white p-4">
      <p className="text-sm font-medium">Tessera in questa squadra</p>
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

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={inCorso || !scelta} className="bottone">
          {inCorso ? 'Tesseramento…' : 'Tessera'}
        </button>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
      </div>
    </form>
  )
}
