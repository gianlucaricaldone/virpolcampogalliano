'use client'

import { useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { RuoloApp } from '@/lib/auth/session'
import type { Utente } from '@/lib/repos/utenti'

const ETICHETTA_RUOLO: Record<string, string> = {
  admin: 'Amministratore',
  dirigente: 'Dirigente',
  allenatore: 'Allenatore',
}

export function TabellaUtenti({
  utenti,
  idCorrente,
  aggiorna,
  reimposta,
}: {
  utenti: Utente[]
  idCorrente: string
  aggiorna: (id: string, dati: { ruolo?: RuoloApp; attivo?: boolean }) => Promise<Risultato<null>>
  reimposta: (id: string) => Promise<Risultato<{ password: string }>>
}) {
  const [errore, setErrore] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  function esegui(azione: () => Promise<Risultato<unknown>>) {
    setErrore(null)
    setPassword(null)
    avvia(async () => {
      const esito = await azione()
      if (!esito.ok) setErrore(esito.errore)
      else if (esito.dati && typeof esito.dati === 'object' && 'password' in esito.dati) {
        setPassword(String(esito.dati.password))
      }
    })
  }

  return (
    <div className="space-y-2">
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
      {password && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 font-mono text-sm">
          Nuova password: <strong>{password}</strong>
        </p>
      )}

      <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
        <thead className="bg-neutral-100 text-left">
          <tr>
            <th className="p-2">Email</th>
            <th className="p-2">Ruolo</th>
            <th className="p-2">Persona</th>
            <th className="p-2">Stato</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2 font-medium">{u.email}</td>
              <td className="p-2 text-neutral-600">{ETICHETTA_RUOLO[u.ruolo] ?? u.ruolo}</td>
              <td className="p-2 text-neutral-600">
                {u.persona ? `${u.persona.cognome} ${u.persona.nome}` : '—'}
              </td>
              <td className="p-2">
                {u.attivo ? 'attivo' : (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">
                    disattivato
                  </span>
                )}
              </td>
              <td className="p-2 text-right">
                <div className="flex justify-end gap-3">
                  <button type="button" disabled={inCorso}
                          onClick={() => esegui(() => reimposta(u.id))}
                          className="underline disabled:opacity-60">
                    Reimposta password
                  </button>
                  {/* Su sé stessi il pulsante non compare: l'azione rifiuterebbe
                      comunque, ma offrirlo e poi negarlo è una trappola. */}
                  {u.id !== idCorrente && (
                    <button type="button" disabled={inCorso}
                            onClick={() => esegui(() => aggiorna(u.id, { attivo: !u.attivo }))}
                            className="underline disabled:opacity-60">
                      {u.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
