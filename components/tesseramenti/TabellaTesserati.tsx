import Link from 'next/link'
import { COLORE_QUOTA, ETICHETTA_QUOTA } from '@/lib/domain/quota'
import type { StatoQuota } from '@/lib/repos/quote'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { Tabella } from '../ui/Tabella'

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
 * Una tabella e non due: prima la rosa e l'elenco erano due componenti con le
 * stesse colonne, e la seconda copia è nata proprio perché la prima mostrava
 * cose diverse. Tenerle separate significa che al prossimo ripensamento una
 * delle due resta indietro.
 *
 * `mostraQuota` non è una preferenza estetica: `v_quote` è security_invoker e
 * per l'allenatore le tabelle finanziarie sono invisibili, quindi la vista gli
 * risponde `stato = 'saldato'` per chiunque. Vedi il test "da v_quote non ricava
 * cifre reali" in tests/db/rls.test.ts: un falso è peggio di un'assenza.
 */
export function TabellaTesserati({
  tesserati,
  codiceStagione,
  quotaPerTesseramento,
  visitaConsegnata,
  mostraQuota,
  mostraSquadra = true,
  vuoto = 'Nessun tesserato corrisponde a questi filtri.',
}: {
  tesserati: Tesserato[]
  codiceStagione: string
  quotaPerTesseramento: Map<string, StatoQuota>
  visitaConsegnata: Map<string, boolean>
  mostraQuota: boolean
  mostraSquadra?: boolean
  vuoto?: string
}) {
  if (tesserati.length === 0) {
    return <p className="rounded-lg border bg-white p-4 text-neutral-600">{vuoto}</p>
  }

  return (
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
        {tesserati.map((t) => {
          const quota = quotaPerTesseramento.get(t.id)
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
                  {quota ? (
                    <span className={`rounded px-2 py-0.5 text-sm ${COLORE_QUOTA[quota]}`}>
                      {ETICHETTA_QUOTA[quota]}
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
  )
}
