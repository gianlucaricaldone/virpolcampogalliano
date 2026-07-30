'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

function Campo({
  nome,
  etichetta,
  valore,
  errore,
  tipo = 'text',
  obbligatorio = false,
  aiuto,
}: {
  nome: string
  etichetta: string
  valore?: string | null
  errore?: string
  tipo?: string
  obbligatorio?: boolean
  aiuto?: string
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={nome} className="text-sm font-medium">
        {etichetta}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        required={obbligatorio}
        defaultValue={valore ?? ''}
        className="mt-1 rounded border px-2 py-1"
      />
      {aiuto && !errore && <p className="mt-1 text-xs text-neutral-500">{aiuto}</p>}
      {errore && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {errore}
        </p>
      )}
    </div>
  )
}

export function FormPersona({
  azione,
  persona,
  etichettaInvio,
}: {
  azione: Azione
  persona?: Persona
  etichettaInvio: string
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={invia} className="space-y-4 rounded border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo nome="cognome" etichetta="Cognome" valore={persona?.cognome} errore={campi?.cognome} obbligatorio />
        <Campo nome="nome" etichetta="Nome" valore={persona?.nome} errore={campi?.nome} obbligatorio />
        <Campo nome="dataNascita" etichetta="Data di nascita" tipo="date" valore={persona?.dataNascita} errore={campi?.dataNascita} obbligatorio />
        <Campo
          nome="codiceFiscale"
          etichetta="Codice fiscale"
          valore={persona?.codiceFiscale}
          errore={campi?.codiceFiscale}
          aiuto="Facoltativo: per i minori spesso non c'è ancora"
        />
        <Campo nome="email" etichetta="Email" tipo="email" valore={persona?.email} errore={campi?.email} />
        <Campo nome="telefono" etichetta="Telefono" valore={persona?.telefono} errore={campi?.telefono} />
        <Campo nome="indirizzo" etichetta="Indirizzo" valore={persona?.indirizzo} errore={campi?.indirizzo} />
        <Campo nome="citta" etichetta="Città" valore={persona?.citta} errore={campi?.citta} />
        <Campo nome="cap" etichetta="CAP" valore={persona?.cap} errore={campi?.cap} />
        <Campo nome="provincia" etichetta="Provincia" valore={persona?.provincia} errore={campi?.provincia} />
      </div>

      <div className="flex flex-col">
        <label htmlFor="note" className="text-sm font-medium">Note</label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={persona?.note ?? ''}
          className="mt-1 rounded border px-2 py-1"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          {inCorso ? 'Salvataggio…' : etichettaInvio}
        </button>
        {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
        {/* Un errore senza `campi` non appartiene a nessun campo: vincolo del
            database tradotto, oppure autorizzazione. Va mostrato comunque,
            altrimenti il salvataggio sembra riuscito. */}
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
      </div>
    </form>
  )
}
