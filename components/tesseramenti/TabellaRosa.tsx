import Link from 'next/link'
import { COLORE_QUOTA, ETICHETTA_QUOTA } from '@/lib/domain/quota'
import type { StatoQuota } from '@/lib/repos/quote'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { Tabella } from '../ui/Tabella'

/**
 * La rosa vista dalla scheda squadra. Al posto di nascita e numero di maglia —
 * l'una si legge nella scheda della persona, l'altro non lo usa nessuno —
 * mostra le due cose che a inizio stagione si controllano a colpo d'occhio,
 * tesserato per tesserato: la quota e il certificato medico.
 *
 * La colonna della quota compare solo per admin e dirigente, e non è una scelta
 * di riservatezza generica: `v_quote` è security_invoker e per l'allenatore le
 * tabelle finanziarie sono invisibili, quindi la vista gli restituisce
 * `quota_attesa = 0, pagato = 0, stato = 'saldato'` per chiunque — un "saldato"
 * falso su tutta la rosa. Vedi il test "da v_quote non ricava cifre reali" in
 * tests/db/rls.test.ts. Mostrargliela sarebbe peggio che nasconderla.
 */
export function TabellaRosa({
  tesserati,
  codiceStagione,
  quotaPerTesseramento,
  visitaConsegnata,
  mostraQuota,
}: {
  tesserati: Tesserato[]
  codiceStagione: string
  quotaPerTesseramento: Map<string, StatoQuota>
  visitaConsegnata: Map<string, boolean>
  mostraQuota: boolean
}) {
  if (tesserati.length === 0) {
    return (
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessun tesserato in questa squadra.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Tesserato</th>
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
