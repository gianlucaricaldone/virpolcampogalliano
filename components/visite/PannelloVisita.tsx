'use client'

import { useActionState, useState } from 'react'
import type { Risultato } from '@/lib/azioni'
import { COLORE_VISITA, descrizioneVisita } from '@/lib/domain/visita'
import type { RigaVisita } from '@/lib/repos/visite'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Lo stato non si calcola qui: arriva da `v_visite`. Questo pannello mostra la
 * frase e permette di registrare quello che si sa del certificato.
 *
 * Tutto è facoltativo, e non per pigrizia: si può sapere la scadenza senza avere
 * il foglio in mano, avere il foglio senza ricordare il giorno in cui è arrivato,
 * o avere solo la promessa che arriverà. Un campo obbligatorio in questo pannello
 * si compila inventando.
 *
 * Il SÌ/NO sono due radio e non una casella: una casella non spuntata non
 * distingue "non consegnata" da "non ho ancora guardato".
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
  const [consegnata, setConsegnata] = useState<'si' | 'no'>(visita.consegnata ? 'si' : 'no')

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <p>
        <span className={`rounded px-2 py-0.5 text-sm ${COLORE_VISITA[visita.stato]}`}>
          {descrizioneVisita(visita)}
        </span>
      </p>

      {modificabile ? (
        <form action={invia} className="space-y-4">
          {/* `items-start` e non `items-end`: il campo della consegna porta una
              riga di aiuto sotto, e allineando i fondi le due etichette
              finivano ad altezze diverse — si vedeva a occhio nudo. */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <fieldset>
              <legend className="text-sm font-medium">Consegnata</legend>
              <div className="mt-1.5 flex overflow-hidden rounded-md border-2 border-[var(--colore-nero)]">
                {[
                  { valore: 'si', etichetta: 'Sì' },
                  { valore: 'no', etichetta: 'No' },
                ].map((o) => (
                  <label
                    key={o.valore}
                    className={`min-h-10 cursor-pointer px-4 py-2 text-sm font-medium ${
                      (consegnata === 'si') === (o.valore === 'si')
                        ? 'bg-[var(--colore-giallo)]'
                        : 'bg-white hover:bg-neutral-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="consegnata"
                      value={o.valore}
                      checked={consegnata === o.valore}
                      onChange={() => setConsegnata(o.valore as 'si' | 'no')}
                      className="sr-only"
                    />
                    {o.etichetta}
                  </label>
                ))}
              </div>
              {campi?.consegnata && (
                <p role="alert" className="mt-1 text-sm text-red-700">{campi.consegnata}</p>
              )}
            </fieldset>

            <div className="flex flex-col">
              <label htmlFor="scadenza" className="text-sm font-medium">
                Scadenza <span className="font-normal text-neutral-500">(facoltativa)</span>
              </label>
              <input
                id="scadenza"
                name="scadenza"
                type="date"
                defaultValue={visita.scadenza ?? ''}
                className="mt-1.5 rounded-md border px-3 text-sm"
              />
              {campi?.scadenza ? (
                <p role="alert" className="mt-1 text-sm text-red-700">{campi.scadenza}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-500">Decide lo stato</p>
              )}
            </div>

            {/* Il campo compare solo su SÌ: una data di consegna su una visita
                dichiarata non consegnata è la combinazione che il vincolo
                visita_consegna_coerente rifiuta. */}
            {consegnata === 'si' && (
              <div className="flex flex-col">
                <label htmlFor="consegnataIl" className="text-sm font-medium">
                  Consegnata il <span className="font-normal text-neutral-500">(facoltativa)</span>
                </label>
                <input
                  id="consegnataIl"
                  name="consegnataIl"
                  type="date"
                  defaultValue={visita.consegnataIl ?? ''}
                  className="mt-1.5 rounded-md border px-3 text-sm"
                />
                {campi?.consegnataIl ? (
                  <p role="alert" className="mt-1 text-sm text-red-700">{campi.consegnataIl}</p>
                ) : (
                  <p className="mt-1 text-xs text-neutral-500">Non incide sullo stato</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={inCorso} className="bottone">
              {inCorso ? 'Salvataggio…' : 'Salva visita'}
            </button>
          {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
          {esito && !esito.ok && !campi && (
            <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
          )}
          </div>
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
