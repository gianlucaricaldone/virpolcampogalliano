'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Cerca = (testo: string) => Promise<Risultato<Persona[]>>

const ATTESA_MS = 200
const MINIMO = 2

/**
 * Ricerca in anagrafica con elenco che si apre mentre si scrive. Sostituisce il
 * form GET con il pulsante Cerca: quello ricaricava la pagina intera per
 * mostrare tre nomi, e su una scheda squadra ce n'erano due, uno per la rosa e
 * uno per lo staff.
 *
 * La ricerca passa da una Server Action e non da una fetch a Supabase: vedi
 * cercaCandidatiAzione. Il componente non sa nulla del database.
 *
 * Tre dettagli che decidono se è usabile:
 *
 * - `richiesta.current`: le risposte tornano in ordine qualsiasi. Senza un
 *   contatore, "ros" digitato dopo "rossi" può essere servito dopo, e l'elenco
 *   mostra i risultati di una parola che nell'input non c'è più.
 * - la tendina si chiude sul blur solo se il focus è uscito dal gruppo: senza il
 *   controllo su `relatedTarget`, il click su un'opzione la fa sparire prima che
 *   il click arrivi a destinazione.
 * - `aria-activedescendant` invece di spostare il focus: il focus resta
 *   nell'input, così si continua a scrivere mentre si scorre con le frecce.
 */
export function RicercaPersona({
  cerca,
  etichetta,
  scelta,
  onScelta,
}: {
  cerca: Cerca
  etichetta: string
  scelta: Persona | null
  onScelta: (persona: Persona | null) => void
}) {
  const id = useId()
  const [testo, setTesto] = useState('')
  const [opzioni, setOpzioni] = useState<Persona[]>([])
  const [aperta, setAperta] = useState(false)
  const [evidenziata, setEvidenziata] = useState(-1)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const richiesta = useRef(0)

  useEffect(() => {
    if (scelta || testo.trim().length < MINIMO) {
      setOpzioni([])
      setAperta(false)
      return
    }
    const mia = ++richiesta.current
    setInCorso(true)
    const attesa = setTimeout(async () => {
      const esito = await cerca(testo)
      if (mia !== richiesta.current) return // risposta di una battuta superata
      setInCorso(false)
      if (!esito.ok) {
        setErrore(esito.errore)
        setOpzioni([])
        return
      }
      setErrore(null)
      setOpzioni(esito.dati)
      setAperta(true)
      setEvidenziata(esito.dati.length > 0 ? 0 : -1)
    }, ATTESA_MS)
    return () => clearTimeout(attesa)
  }, [testo, scelta, cerca])

  function scegli(persona: Persona) {
    onScelta(persona)
    setTesto('')
    setOpzioni([])
    setAperta(false)
    setEvidenziata(-1)
  }

  if (scelta) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-10 items-center gap-2 rounded border-2 border-[var(--colore-nero)] bg-[var(--colore-giallo)] px-3 text-sm">
          <strong>{scelta.cognome} {scelta.nome}</strong>
        </span>
        <button type="button" onClick={() => onScelta(null)} className="text-sm underline">
          Cambia
        </button>
      </div>
    )
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAperta(false)
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">{etichetta}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={aperta}
        aria-controls={`${id}-elenco`}
        aria-activedescendant={evidenziata >= 0 ? `${id}-opzione-${evidenziata}` : undefined}
        value={testo}
        placeholder="Cognome"
        onChange={(e) => setTesto(e.target.value)}
        onFocus={() => opzioni.length > 0 && setAperta(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && opzioni.length > 0) {
            e.preventDefault()
            setAperta(true)
            setEvidenziata((i) => (i + 1) % opzioni.length)
          } else if (e.key === 'ArrowUp' && opzioni.length > 0) {
            e.preventDefault()
            setEvidenziata((i) => (i <= 0 ? opzioni.length - 1 : i - 1))
          } else if (e.key === 'Enter') {
            // preventDefault sempre, anche senza selezione: altrimenti Invio
            // qui invierebbe il form che contiene la ricerca.
            e.preventDefault()
            if (aperta && evidenziata >= 0) scegli(opzioni[evidenziata])
          } else if (e.key === 'Escape') {
            setAperta(false)
          }
        }}
        className="mt-1.5 w-full max-w-xs rounded-md border px-3 text-sm"
      />

      {inCorso && <p className="mt-1 text-xs text-neutral-500">Ricerca…</p>}
      {errore && <p role="alert" className="mt-1 text-sm text-red-700">{errore}</p>}
      {aperta && opzioni.length === 0 && !inCorso && (
        <p className="mt-1 text-sm text-neutral-600">Nessuna persona disponibile con questo cognome.</p>
      )}

      <ul
        id={`${id}-elenco`}
        role="listbox"
        hidden={!aperta || opzioni.length === 0}
        className="absolute z-20 mt-1 max-h-64 w-full max-w-xs overflow-y-auto rounded border-2 border-[var(--colore-nero)] bg-white shadow-[3px_3px_0_0_var(--colore-nero)]"
      >
        {opzioni.map((p, i) => (
          <li
            key={p.id}
            id={`${id}-opzione-${i}`}
            role="option"
            aria-selected={i === evidenziata}
          >
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setEvidenziata(i)}
              onClick={() => scegli(p)}
              className={`block w-full px-3 py-2 text-left text-sm ${
                i === evidenziata ? 'bg-[var(--colore-giallo)]' : 'hover:bg-neutral-100'
              }`}
            >
              {p.cognome} {p.nome}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
