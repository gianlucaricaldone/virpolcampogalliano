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
  ampiezza = 'sm:col-span-3',
}: {
  nome: string
  etichetta: string
  valore?: string | null
  errore?: string
  tipo?: string
  obbligatorio?: boolean
  aiuto?: string
  ampiezza?: string
}) {
  return (
    <div className={`flex flex-col ${ampiezza}`}>
      <label htmlFor={nome} className="text-sm font-medium text-neutral-700">
        {etichetta}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        required={obbligatorio}
        defaultValue={valore ?? ''}
        className="mt-1.5 rounded-md border px-3 text-sm"
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

/**
 * Undici campi in una griglia uniforme sono un muro: si legge dall'alto in
 * basso senza sapere quando finisce una cosa e ne comincia un'altra. Divisi in
 * tre gruppi nominati — chi è, come si raggiunge, dove abita — si scorrono a
 * colpo d'occhio, e chi compila sa quanto manca.
 */
function Gruppo({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {titolo}
      </legend>
      <div className="mt-3 grid gap-x-4 gap-y-4 sm:grid-cols-6">{children}</div>
    </fieldset>
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
    <form action={invia} className="space-y-6 rounded-lg border bg-white p-6">
      <Gruppo titolo="Anagrafica">
        <Campo nome="cognome" etichetta="Cognome" valore={persona?.cognome} errore={campi?.cognome} obbligatorio />
        <Campo nome="nome" etichetta="Nome" valore={persona?.nome} errore={campi?.nome} obbligatorio />
        <Campo
          nome="dataNascita"
          etichetta="Data di nascita"
          tipo="date"
          valore={persona?.dataNascita}
          errore={campi?.dataNascita}
          obbligatorio
          ampiezza="sm:col-span-2"
        />
        <Campo
          nome="codiceFiscale"
          etichetta="Codice fiscale"
          valore={persona?.codiceFiscale}
          errore={campi?.codiceFiscale}
          aiuto="Facoltativo: per i minori spesso non c'è ancora"
          ampiezza="sm:col-span-4"
        />
      </Gruppo>

      <Gruppo titolo="Recapiti">
        <Campo nome="email" etichetta="Email" tipo="email" valore={persona?.email} errore={campi?.email} />
        <Campo nome="telefono" etichetta="Telefono" valore={persona?.telefono} errore={campi?.telefono} />
      </Gruppo>

      <Gruppo titolo="Residenza">
        <Campo nome="indirizzo" etichetta="Indirizzo" valore={persona?.indirizzo} errore={campi?.indirizzo} />
        <Campo nome="citta" etichetta="Città" valore={persona?.citta} errore={campi?.citta} />
        {/* CAP e provincia sono di lunghezza nota: un campo largo quanto
            l'indirizzo suggerisce che ci vada dentro altro. */}
        <Campo nome="cap" etichetta="CAP" valore={persona?.cap} errore={campi?.cap} ampiezza="sm:col-span-1" />
        <Campo nome="provincia" etichetta="Provincia" valore={persona?.provincia} errore={campi?.provincia} ampiezza="sm:col-span-1" />
      </Gruppo>

      <div className="flex flex-col">
        <label htmlFor="note" className="text-sm font-medium text-neutral-700">Note</label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={persona?.note ?? ''}
          className="mt-1.5 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 border-t pt-5">
        <button
          type="submit"
          disabled={inCorso}
          className="min-h-10 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
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
