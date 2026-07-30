import Link from 'next/link'
import { formattaEuro } from '@/lib/domain/denaro'
import type { RigaQuota } from '@/lib/repos/quote'

export function RiquadroQuote({
  righe,
  codiceStagione,
}: {
  righe: RigaQuota[]
  codiceStagione: string
}) {
  const totale = righe.reduce((somma, r) => somma + Math.max(r.residuo, 0), 0)

  return (
    // aria-labelledby: senza un nome accessibile un <section> non è una
    // "region" per la tecnologia assistiva — resta un contenitore anonimo, e
    // chi naviga per landmark non lo trova.
    <section aria-labelledby="titolo-quote" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titolo-quote" className="text-lg font-semibold">Quote da incassare</h2>
        <Link href={`/${codiceStagione}/quote`} className="text-sm underline">
          Tutte le quote
        </Link>
      </div>

      {righe.length === 0 ? (
        <p className="rounded border bg-white p-4 text-neutral-600">
          Nessuna quota aperta.
        </p>
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            {righe.length} {righe.length === 1 ? 'tesserato' : 'tesserati'} · {formattaEuro(totale)}
          </p>
          <ul className="divide-y rounded border bg-white">
            {righe.map((r) => (
              <li key={r.tesseramentoId} className="flex items-baseline justify-between gap-3 p-2 text-sm">
                <Link
                  href={`/${codiceStagione}/tesseramenti/${r.tesseramentoId}`}
                  className="underline"
                >
                  {r.persona.cognome} {r.persona.nome}
                </Link>
                <span className="text-neutral-600">
                  {r.squadra?.nome ?? 'senza squadra'} · manca {formattaEuro(r.residuo)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
