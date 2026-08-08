'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<{ email: string; password: string }> | null,
  form: FormData,
) => Promise<Risultato<{ email: string; password: string }>>

const RUOLI = [
  { valore: 'allenatore', etichetta: 'Allenatore' },
  { valore: 'dirigente', etichetta: 'Dirigente' },
  { valore: 'admin', etichetta: 'Amministratore' },
]

export function FormNuovoUtente({
  azione,
  candidati,
}: {
  azione: Azione
  candidati: Persona[]
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <div className="space-y-3">
      {esito?.ok && (
        // Mostrata una volta sola: non viene riletta da nessuna parte, e alla
        // prossima navigazione sparisce. Se l'admin la perde, la rigenera dalla
        // riga in tabella.
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <p className="text-sm text-green-900">
            Utente creato. Comunica queste credenziali a voce:
          </p>
          <p className="mt-2 font-mono text-sm">
            {esito.dati.email} · <strong>{esito.dati.password}</strong>
          </p>
        </div>
      )}

      <form action={invia} className="space-y-3 rounded border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required
                   className="mt-1 rounded border px-2 py-1" />
            {campi?.email && <p role="alert" className="mt-1 text-sm text-red-700">{campi.email}</p>}
          </div>
          <div className="flex flex-col">
            <label htmlFor="ruolo" className="text-sm font-medium">Ruolo</label>
            <select id="ruolo" name="ruolo" className="mt-1 rounded border px-2 py-1">
              {RUOLI.map((r) => (
                <option key={r.valore} value={r.valore}>{r.etichetta}</option>
              ))}
            </select>
            {campi?.ruolo && <p role="alert" className="mt-1 text-sm text-red-700">{campi.ruolo}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Persona in anagrafica</legend>
          <p className="text-xs text-neutral-500">
            Obbligatoria per un allenatore: senza, non vedrebbe nessuna squadra.
          </p>
          {campi?.personaId && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.personaId}</p>
          )}
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            <label className="flex items-center gap-2 rounded px-2 py-1">
              <input type="radio" name="personaId" value="" defaultChecked />
              <span className="text-sm text-neutral-600">Nessuna</span>
            </label>
            {candidati.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-50">
                <input type="radio" name="personaId" value={p.id} />
                <span className="text-sm">{p.cognome} {p.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={inCorso}
                  className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60">
            {inCorso ? 'Creazione…' : 'Crea utente'}
          </button>
          {esito && !esito.ok && !campi && (
            <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
          )}
        </div>
      </form>
    </div>
  )
}
