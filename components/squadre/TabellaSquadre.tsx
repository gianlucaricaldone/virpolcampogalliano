'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Squadra } from '@/lib/repos/squadre'
import { Tabella } from '../ui/Tabella'

type Colonna = 'nome' | 'categoria' | 'annata'

const COLONNE: { chiave: Colonna; etichetta: string }[] = [
  { chiave: 'nome', etichetta: 'Squadra' },
  { chiave: 'categoria', etichetta: 'Categoria' },
  { chiave: 'annata', etichetta: 'Annata' },
]

/**
 * Ordinamento e filtro in memoria, non nell'URL e non nel database.
 *
 * Le squadre di una stagione sono ventidue nel caso peggiore visto finora: sono
 * già tutte nella pagina, e mandare un parametro al server per riordinare venti
 * righe vorrebbe dire un giro di rete e un ricaricamento per un lavoro che il
 * browser fa in un millisecondo.
 *
 * Qui c'era scritto che per l'anagrafica la scelta sarebbe stata l'opposta.
 * Sbagliato, e corretto quando l'anagrafica ha avuto il suo filtro: quella
 * pagina non è paginata e il server legge comunque l'elenco intero, quindi le
 * righe sono già nel browser esattamente come queste. Il discrimine non è
 * quante righe ci sono, è se la pagina le ha già tutte — e il limite vero, per
 * entrambe, è `max_rows` di PostgREST: oltre mille righe il client filtrerebbe
 * un elenco troncato senza dirlo. Vedi TabellaPersone.
 *
 * Il confronto usa `localeCompare` con `numeric: true`: i nomi delle squadre qui
 * sono annate — "2010", "2011/2012", "2019/2020" — e un ordinamento di stringhe
 * metterebbe "2010" dopo "2011/2012" appena una società usasse "9" o "10" per
 * qualcosa. Con `numeric` le cifre si confrontano come numeri.
 */
export function TabellaSquadre({
  squadre,
  codiceStagione,
}: {
  squadre: Squadra[]
  codiceStagione: string
}) {
  const [filtro, setFiltro] = useState('')
  const [ordine, setOrdine] = useState<{ colonna: Colonna; crescente: boolean }>({
    colonna: 'nome',
    crescente: true,
  })

  const visibili = useMemo(() => {
    const cercato = filtro.trim().toLowerCase()
    const filtrate = cercato
      ? squadre.filter((s) =>
          `${s.nome} ${s.categoria} ${s.annata ?? ''}`.toLowerCase().includes(cercato))
      : squadre
    const segno = ordine.crescente ? 1 : -1
    return [...filtrate].sort((a, b) => {
      const va = ordine.colonna === 'annata' ? a.annata : a[ordine.colonna]
      const vb = ordine.colonna === 'annata' ? b.annata : b[ordine.colonna]
      // Le annate mancanti in fondo in entrambi i versi: una squadra senza
      // annata non è "la più piccola", è una di cui non si sa.
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * segno
      return String(va).localeCompare(String(vb), 'it', { numeric: true }) * segno
    })
  }, [squadre, filtro, ordine])

  if (squadre.length === 0) {
    return (
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessuna squadra in questa stagione.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
        <div className="flex flex-col">
          <label htmlFor="filtro-squadre" className="text-sm font-medium">
            Cerca fra le squadre
          </label>
          <input
            id="filtro-squadre"
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Nome, categoria o annata"
            className="mt-1.5 w-full rounded-md border px-3 text-sm sm:w-64"
          />
        </div>
        {/* Il conteggio è l'unico modo di sapere che il filtro sta filtrando:
            senza, un elenco corto e un filtro troppo stretto si somigliano. */}
        <p aria-live="polite" className="text-sm text-neutral-600">
          {visibili.length === squadre.length
            ? `${squadre.length} squadre`
            : `${visibili.length} di ${squadre.length}`}
        </p>
      </div>

      {visibili.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">
          Nessuna squadra corrisponde a «{filtro}».
        </p>
      ) : (
        <Tabella>
          <thead className="text-left">
            <tr>
              {COLONNE.map((c) => {
                const attiva = ordine.colonna === c.chiave
                return (
                  <th
                    key={c.chiave}
                    // aria-sort è ciò che rende l'ordinamento percepibile a chi
                    // usa uno screen reader: la freccia da sola è decorazione.
                    aria-sort={attiva ? (ordine.crescente ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOrdine((o) =>
                          o.colonna === c.chiave
                            ? { colonna: c.chiave, crescente: !o.crescente }
                            : { colonna: c.chiave, crescente: true })
                      }
                      className="inline-flex items-center gap-1 uppercase underline-offset-4 hover:underline"
                    >
                      {c.etichetta}
                      <span aria-hidden="true" className={attiva ? '' : 'opacity-30'}>
                        {attiva && !ordine.crescente ? '▾' : '▴'}
                      </span>
                    </button>
                  </th>
                )
              })}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {visibili.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">
                  <Link href={`/${codiceStagione}/squadre/${s.id}`} className="underline">
                    {s.nome}
                  </Link>
                </td>
                <td className="text-neutral-600">{s.categoria || '—'}</td>
                <td className="text-neutral-600">{s.annata ?? '—'}</td>
                <td className="text-neutral-600">{s.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      )}
    </div>
  )
}
