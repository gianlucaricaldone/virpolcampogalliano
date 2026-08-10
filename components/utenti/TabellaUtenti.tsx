'use client'

import { useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { RuoloApp } from '@/lib/auth/session'
import type { Utente } from '@/lib/repos/utenti'
import { Tabella } from '../ui/Tabella'

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

      {/*
        La cornice condivisa, non una tabella con stili propri: questa aveva
        `p-2`, un'intestazione grigia diversa da tutte le altre e — soprattutto —
        nessuno scroll interno. Su un telefono le cinque colonne allargavano il
        viewport a 605px invece di 390: la pagina intera scorreva in orizzontale,
        che è il difetto per cui `Tabella` esiste.
      */}
      <Tabella>
        <thead className="text-left">
          <tr>
            <th>Email</th>
            <th>Ruolo</th>
            {/* "Nome" e non "Persona": la colonna mostra cognome e nome, e
                "persona" è il nome della tabella nel database, non una parola
                che chi legge deve conoscere. */}
            <th>Nome</th>
            <th>Stato</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.email}</td>
              <td className="text-neutral-600">{ETICHETTA_RUOLO[u.ruolo] ?? u.ruolo}</td>
              <td className="text-neutral-600">
                {u.persona ? `${u.persona.cognome} ${u.persona.nome}` : '—'}
              </td>
              <td>
                {u.attivo ? 'attivo' : (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">
                    disattivato
                  </span>
                )}
              </td>
              <td className="text-right">
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
      </Tabella>
    </div>
  )
}
