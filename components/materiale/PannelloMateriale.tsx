'use client'

import { useActionState, useState } from 'react'
import type { Risultato } from '@/lib/azioni'
import { coloreMateriale, descrizioneMateriale, TAGLIE } from '@/lib/domain/materiale'
import { SceltaSiNo } from '../ui/SceltaSiNo'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Materiale sportivo: consegnato sì o no, e in che taglia.
 *
 * IL CAMPO TAGLIA È SEMPRE VISIBILE, anche sul NO — ed è la differenza dal
 * pannello della visita, dove la data di consegna compare solo dopo un Sì. Là
 * la combinazione «non consegnata, ma consegnata il…» è una contraddizione che
 * un vincolo del database rifiuta. Qui «taglia M, non ancora consegnato» è il
 * caso normale: le taglie si raccolgono a inizio stagione, la fornitura arriva
 * dopo. Nascondere il campo sul NO renderebbe impossibile registrare l'unica
 * cosa che a quel punto si sa.
 */
export function PannelloMateriale({
  materiale,
  azione,
  modificabile,
}: {
  materiale: { consegnato: boolean; taglia: string | null }
  azione: Azione
  modificabile: boolean
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined
  const [consegnato, setConsegnato] = useState(materiale.consegnato)

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <p>
        <span className={`rounded px-2 py-0.5 text-sm ${coloreMateriale(materiale)}`}>
          {descrizioneMateriale(materiale)}
        </span>
      </p>

      {modificabile ? (
        <form action={invia} className="space-y-4">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            <SceltaSiNo
              nome="consegnato"
              legenda="Consegnato"
              valore={consegnato}
              cambia={setConsegnato}
              errore={campi?.consegnato}
            />

            <div className="flex flex-col">
              <label htmlFor="taglia" className="text-sm font-medium">
                Taglia <span className="font-normal text-neutral-500">(facoltativa)</span>
              </label>
              {/* Un menù e non un campo libero: la stessa misura scritta 'M',
                  'm' e 'media' diventerebbe tre voci nel filtro dell'elenco. La
                  scala vive in TAGLIE, che il vincolo del database ricalca. */}
              <select
                id="taglia"
                name="taglia"
                defaultValue={materiale.taglia ?? ''}
                className="mt-1.5 min-h-10 rounded-md border px-3 text-sm"
              >
                <option value="">Non registrata</option>
                {TAGLIE.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {campi?.taglia ? (
                <p role="alert" className="mt-1 text-sm text-red-700">{campi.taglia}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-500">Si può registrare prima</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={inCorso} className="bottone">
              {inCorso ? 'Salvataggio…' : 'Salva materiale'}
            </button>
            {esito?.ok && <p className="text-sm text-green-700">Salvato</p>}
            {esito && !esito.ok && !campi && (
              <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-neutral-600">
          Solo la segreteria registra le consegne, e solo a stagione aperta.
        </p>
      )}
    </div>
  )
}
