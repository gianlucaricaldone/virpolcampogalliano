'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formattaData } from '@/lib/domain/data'
import type { Persona } from '@/lib/repos/persone'
import { Tabella } from '../ui/Tabella'

/**
 * Anagrafica con filtro che si applica mentre si scrive.
 *
 * IL FILTRO STA QUI E NON NEL SERVER, al contrario di quanto valeva prima e al
 * contrario della nota in TabellaSquadre sull'anagrafica. La ragione: la pagina
 * carica già tutte le persone: non c'è paginazione, e il server leggeva l'elenco
 * intero anche quando la ricerca era vuota. Le righe sono quindi già nel
 * browser, e filtrarle costa un millisecondo contro un giro di rete per battuta.
 *
 * Il server NON filtra più per cognome, e non è una dimenticanza: se filtrasse
 * anche lui, allargare la ricerca — da "ross" a "ros" — mostrerebbe solo il
 * sottoinsieme già scaricato, cioè il nulla, fino a un ricaricamento. Una sola
 * fonte del filtro.
 *
 * `archiviate` resta invece un giro dal server, perché cambia quali righe
 * vengono lette e nessun filtro client può inventarsi le archiviate che non ha.
 *
 * COSA SI PERDE: senza JavaScript il filtro per cognome non funziona più. Prima
 * era un form GET e un commento lo difendeva esplicitamente. È un cambio
 * deliberato, coerente con dove è andata l'applicazione — l'autocomplete della
 * scheda squadra e il filtro delle squadre richiedono già JS — e il limite vero
 * è un altro: sopra le mille persone PostgREST tronca (`max_rows` in
 * supabase/config.toml) e il filtro client vedrebbe un elenco incompleto senza
 * dirlo. A quel punto la ricerca va spostata nel server, con la paginazione.
 */
export function TabellaPersone({
  persone,
  ricercaIniziale = '',
  mostraArchiviate,
}: {
  persone: Persona[]
  ricercaIniziale?: string
  mostraArchiviate: boolean
}) {
  const router = useRouter()
  const [filtro, setFiltro] = useState(ricercaIniziale)

  /*
   * `history.replaceState` e non `router.replace`: il secondo rieseguirebbe il
   * server component a ogni battuta, che è precisamente il giro di rete che
   * questo filtro esiste per evitare. Così l'URL resta condivisibile — chi apre
   * /anagrafica?q=rossi trova il campo già compilato e la tabella già filtrata —
   * senza che scrivere costi una richiesta.
   */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (filtro) url.searchParams.set('q', filtro)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
  }, [filtro])

  const visibili = useMemo(() => {
    const cercato = filtro.trim().toLowerCase()
    if (!cercato) return persone
    // Cognome, nome e codice fiscale: chi cerca in anagrafica ha in mano una di
    // queste tre cose, e ricordarsi quale campo interroga la casella è lavoro
    // in più per chi la usa.
    return persone.filter((p) =>
      `${p.cognome} ${p.nome} ${p.codiceFiscale ?? ''}`.toLowerCase().includes(cercato))
  }, [persone, filtro])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-end gap-x-4 gap-y-3 rounded-lg border bg-white p-3 sm:flex sm:flex-wrap sm:gap-x-6 sm:p-4">
        <div className="col-span-2 flex flex-col sm:col-span-1">
          <label htmlFor="q" className="text-sm font-medium">Cognome</label>
          <input
            id="q"
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Cognome, nome o codice fiscale"
            className="mt-1.5 w-full rounded-md border px-3 text-sm sm:w-72"
          />
        </div>

        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mostraArchiviate}
            onChange={(e) => {
              // Questo sì passa dal server: decide quali righe leggere.
              const url = new URL(window.location.href)
              if (e.target.checked) url.searchParams.set('archiviate', '1')
              else url.searchParams.delete('archiviate')
              router.push(`${url.pathname}${url.search}`)
            }}
          />
          Mostra anche le archiviate
        </label>

        <p aria-live="polite" className="text-sm text-neutral-600">
          {visibili.length === persone.length
            ? `${persone.length} ${persone.length === 1 ? 'persona' : 'persone'}`
            : `${visibili.length} di ${persone.length}`}
        </p>
      </div>

      {visibili.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">
          Nessuna persona corrisponde alla ricerca.
        </p>
      ) : (
        <Tabella>
          <thead className="text-left">
            <tr>
              <th>Cognome e nome</th>
              <th>Nascita</th>
              <th>Codice fiscale</th>
              <th>Recapiti</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {visibili.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">
                  <Link href={`/anagrafica/${p.id}`} className="underline">
                    {p.cognome} {p.nome}
                  </Link>
                </td>
                <td className="text-neutral-600">{formattaData(p.dataNascita)}</td>
                <td className="text-neutral-600">{p.codiceFiscale ?? '—'}</td>
                <td className="text-neutral-600">{p.telefono ?? p.email ?? '—'}</td>
                <td>
                  {p.attiva ? (
                    <span className="text-neutral-600">attiva</span>
                  ) : (
                    <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">
                      archiviata
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      )}
    </div>
  )
}
