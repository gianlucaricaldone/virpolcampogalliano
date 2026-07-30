import Link from 'next/link'
import { COLORE_VISITA, descrizioneVisita } from '@/lib/domain/visita'
import type { RigaVisita } from '@/lib/repos/visite'

export function RiquadroVisite({
  righe,
  codiceStagione,
}: {
  righe: RigaVisita[]
  codiceStagione: string
}) {
  return (
    // Vedi RiquadroQuote: senza nome accessibile il <section> non è una region.
    <section aria-labelledby="titolo-visite" className="space-y-2">
      <h2 id="titolo-visite" className="text-lg font-semibold">
        Visite mediche da sistemare
      </h2>

      {righe.length === 0 ? (
        <p className="rounded border bg-white p-4 text-neutral-600">
          Nessuna visita mancante o in scadenza.
        </p>
      ) : (
        <>
          <p className="text-sm text-neutral-600">
            {righe.length} {righe.length === 1 ? 'tesserato' : 'tesserati'}
          </p>
          <ul className="divide-y rounded border bg-white">
            {righe.map((r) => (
              <li key={r.tesseramentoId} className="flex flex-wrap items-baseline justify-between gap-3 p-2 text-sm">
                <Link
                  href={`/${codiceStagione}/tesseramenti/${r.tesseramentoId}`}
                  className="underline"
                >
                  {r.persona.cognome} {r.persona.nome}
                </Link>
                <span className="flex items-baseline gap-2">
                  <span className="text-neutral-600">{r.squadra?.nome ?? 'senza squadra'}</span>
                  <span className={`rounded px-2 py-0.5 ${COLORE_VISITA[r.stato]}`}>
                    {descrizioneVisita(r)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
