'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { COLORE_QUOTA, ETICHETTA_QUOTA } from '@/lib/domain/quota'
import type { StatoQuota } from '@/lib/repos/quote'
import type { Squadra } from '@/lib/repos/squadre'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { Tabella } from '../ui/Tabella'

const STATI_QUOTA: StatoQuota[] = ['non_pagato', 'parziale', 'saldato']

/**
 * L'elenco dei tesserati, uguale nella rosa di una squadra e nell'elenco della
 * stagione: cambia solo la colonna Squadra, che nella rosa sarebbe la stessa su
 * ogni riga.
 *
 * Le colonne sono le due cose che si controllano tesserato per tesserato — la
 * quota e il certificato medico — al posto di nascita e numero di maglia. La
 * data di nascita si legge nella scheda della persona; il numero di maglia è il
 * dato che la società non usa.
 *
 * I FILTRI SONO QUI, non nel server, per la stessa ragione dell'anagrafica: la
 * pagina carica già tutti i tesserati della stagione — centottantasei in
 * produzione, nessuna paginazione — quindi le righe sono nel browser e filtrarle
 * costa un millisecondo contro un giro di rete per battuta. Il limite è lo
 * stesso: oltre le mille righe PostgREST tronca (`max_rows` in
 * supabase/config.toml) e il filtro mostrerebbe un elenco incompleto senza dirlo.
 *
 * Il filtro per squadra resta invece un giro dal server, perché decide quali
 * righe leggere — ma sta nella stessa barra degli altri e naviga al cambio,
 * senza pulsante. Prima era un form GET a parte, e la pagina mostrava due
 * riquadri di filtri uno sopra l'altro: chi li guardava non aveva modo di sapere
 * perché fossero due.
 *
 * `mostraQuota` non è una preferenza estetica: `v_quote` è security_invoker e
 * per l'allenatore le tabelle finanziarie sono invisibili, quindi la vista gli
 * risponde `stato = 'saldato'` per chiunque. Vedi il test "da v_quote non ricava
 * cifre reali" in tests/db/rls.test.ts: un falso è peggio di un'assenza. Per lo
 * stesso motivo a lui non si offre nemmeno il filtro sulla quota — filtrerebbe
 * su un dato inventato.
 */
export function TabellaTesserati({
  tesserati,
  codiceStagione,
  quotaPerTesseramento,
  visitaConsegnata,
  mostraQuota,
  mostraSquadra = true,
  vuoto = 'Nessun tesserato corrisponde a questi filtri.',
  squadre,
  squadraSelezionata = '',
  senzaSquadra = false,
}: {
  tesserati: Tesserato[]
  codiceStagione: string
  quotaPerTesseramento: Map<string, StatoQuota>
  visitaConsegnata: Map<string, boolean>
  mostraQuota: boolean
  mostraSquadra?: boolean
  vuoto?: string
  /** Solo nell'elenco di stagione: nella rosa di una squadra non ha senso. */
  squadre?: Squadra[]
  squadraSelezionata?: string
  senzaSquadra?: boolean
}) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [visita, setVisita] = useState<'' | 'si' | 'no'>('')
  const [quota, setQuota] = useState<'' | StatoQuota>('')

  const visibili = useMemo(() => {
    const cercato = nome.trim().toLowerCase()
    return tesserati.filter((t) => {
      if (cercato && !`${t.persona.cognome} ${t.persona.nome}`.toLowerCase().includes(cercato)) {
        return false
      }
      if (visita) {
        const consegnata = visitaConsegnata.get(t.id) ?? false
        if (visita === 'si' ? !consegnata : consegnata) return false
      }
      // Chi non ha una riga in v_quote non corrisponde a nessuno stato: escluso
      // dal filtro invece che assegnato d'ufficio a "non pagato", che sarebbe
      // un'affermazione che il database non fa.
      if (quota && quotaPerTesseramento.get(t.id) !== quota) return false
      return true
    })
  }, [tesserati, nome, visita, quota, visitaConsegnata, quotaPerTesseramento])

  const filtrato = visibili.length !== tesserati.length

  /*
   * I due filtri che cambiano la query passano dal server. `router.push` e non
   * `replaceState`: qui le righe da leggere sono altre, e senza una nuova
   * richiesta la tabella resterebbe quella di prima.
   */
  function vaiA(cambi: Record<string, string>) {
    const url = new URL(window.location.href)
    for (const [chiave, valore] of Object.entries(cambi)) {
      if (valore) url.searchParams.set(chiave, valore)
      else url.searchParams.delete(chiave)
    }
    router.push(`${url.pathname}${url.search}`)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 rounded-lg border bg-white p-3 sm:flex sm:flex-wrap sm:gap-x-6 sm:p-4">
        {squadre && (
          <>
            <div className="flex flex-col">
              <label htmlFor="filtro-squadra" className="text-sm font-medium">Squadra</label>
              <select
                id="filtro-squadra"
                value={squadraSelezionata}
                disabled={senzaSquadra}
                onChange={(e) => vaiA({ squadra: e.target.value })}
                className="mt-1.5 rounded-md border px-3 text-sm disabled:bg-neutral-100"
              >
                <option value="">Tutte</option>
                {squadre.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm sm:self-center sm:pt-5">
              {/* Ha la precedenza sul filtro per squadra: sono due domande
                  diverse e sceglierne una sola evita un elenco vuoto senza
                  spiegazione. Il menù si disabilita da sé, così la precedenza
                  si vede invece di essere solo vera. */}
              <input
                type="checkbox"
                checked={senzaSquadra}
                onChange={(e) => vaiA({ senza: e.target.checked ? '1' : '' })}
              />
              Solo chi non ha una squadra
            </label>
          </>
        )}

        <div className="col-span-2 flex flex-col sm:col-span-1">
          <label htmlFor="filtro-nome" className="text-sm font-medium">Nome</label>
          <input
            id="filtro-nome"
            type="search"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Cognome o nome"
            className="mt-1.5 w-full rounded-md border px-3 text-sm sm:w-56"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="filtro-visita" className="text-sm font-medium">Visita</label>
          <select
            id="filtro-visita"
            value={visita}
            onChange={(e) => setVisita(e.target.value as '' | 'si' | 'no')}
            className="mt-1.5 rounded-md border px-3 text-sm"
          >
            <option value="">Tutti</option>
            <option value="si">Consegnata</option>
            <option value="no">Non consegnata</option>
          </select>
        </div>

        {mostraQuota && (
          <div className="flex flex-col">
            <label htmlFor="filtro-quota" className="text-sm font-medium">Quota</label>
            <select
              id="filtro-quota"
              value={quota}
              onChange={(e) => setQuota(e.target.value as '' | StatoQuota)}
              className="mt-1.5 rounded-md border px-3 text-sm"
            >
              <option value="">Tutte</option>
              {STATI_QUOTA.map((s) => (
                <option key={s} value={s}>{ETICHETTA_QUOTA[s]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Il conteggio è l'unico modo di sapere che i filtri stanno filtrando:
            un elenco corto e un filtro troppo stretto si somigliano. */}
        <p aria-live="polite" className="text-sm text-neutral-600">
          {filtrato
            ? `${visibili.length} di ${tesserati.length}`
            : `${tesserati.length} ${tesserati.length === 1 ? 'tesserato' : 'tesserati'}`}
        </p>

        {filtrato && (
          <button
            type="button"
            onClick={() => { setNome(''); setVisita(''); setQuota('') }}
            className="text-sm underline"
          >
            Azzera i filtri
          </button>
        )}
      </div>

      {visibili.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">{vuoto}</p>
      ) : (
        <Tabella>
          <thead className="text-left">
            <tr>
              <th>Tesserato</th>
              {mostraSquadra && <th>Squadra</th>}
              {mostraQuota && <th>Quota</th>}
              <th>Visita consegnata</th>
            </tr>
          </thead>
          <tbody>
            {visibili.map((t) => {
              const statoQuota = quotaPerTesseramento.get(t.id)
              const consegnata = visitaConsegnata.get(t.id) ?? false
              return (
                <tr key={t.id}>
                  <td className="font-medium">
                    <Link href={`/${codiceStagione}/tesseramenti/${t.id}`} className="underline">
                      {t.persona.cognome} {t.persona.nome}
                    </Link>
                  </td>
                  {mostraSquadra && (
                    <td className="text-neutral-600">
                      {t.squadra ? (
                        <Link
                          href={`/${codiceStagione}/squadre/${t.squadra.id}`}
                          className="underline"
                        >
                          {t.squadra.nome}
                        </Link>
                      ) : (
                        <span className="text-neutral-500">senza squadra</span>
                      )}
                    </td>
                  )}
                  {mostraQuota && (
                    <td>
                      {statoQuota ? (
                        <span className={`rounded px-2 py-0.5 text-sm ${COLORE_QUOTA[statoQuota]}`}>
                          {ETICHETTA_QUOTA[statoQuota]}
                        </span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        consegnata ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {consegnata ? 'Sì' : 'No'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Tabella>
      )}
    </div>
  )
}
