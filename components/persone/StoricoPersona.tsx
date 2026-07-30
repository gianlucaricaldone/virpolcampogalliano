import Link from 'next/link'
import type { Storico } from '@/lib/repos/persone'

const RUOLI: Record<string, string> = {
  allenatore: 'Allenatore',
  vice_allenatore: 'Vice allenatore',
  dirigente_squadra: 'Dirigente di squadra',
}

/**
 * Tutte le stagioni, dalla più recente. È la ragione per cui l'anagrafica è
 * separata dall'appartenenza: chi guarda la scheda di un ragazzo vuole sapere
 * dove ha giocato negli anni, non solo dove gioca adesso.
 */
export function StoricoPersona({ storico }: { storico: Storico }) {
  const vuoto = storico.tesseramenti.length === 0 && storico.incarichi.length === 0

  if (vuoto) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessun tesseramento né incarico registrato.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {storico.tesseramenti.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tesseramenti</h3>
          <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr>
                <th className="p-2">Stagione</th>
                <th className="p-2">Squadra</th>
                <th className="p-2">Maglia</th>
              </tr>
            </thead>
            <tbody>
              {storico.tesseramenti.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.stagione.etichetta}</td>
                  <td className="p-2">
                    {t.squadra ? (
                      <Link
                        href={`/${t.stagione.codice}/squadre/${t.squadra.id}`}
                        className="underline"
                      >
                        {t.squadra.nome}
                      </Link>
                    ) : (
                      <span className="text-neutral-500">senza squadra</span>
                    )}
                  </td>
                  <td className="p-2 text-neutral-600">{t.numeroMaglia ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {storico.incarichi.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Incarichi di staff</h3>
          <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
            <thead className="bg-neutral-100 text-left">
              <tr>
                <th className="p-2">Stagione</th>
                <th className="p-2">Squadra</th>
                <th className="p-2">Ruolo</th>
              </tr>
            </thead>
            <tbody>
              {storico.incarichi.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.stagione.etichetta}</td>
                  <td className="p-2">
                    <Link
                      href={`/${i.stagione.codice}/squadre/${i.squadra.id}`}
                      className="underline"
                    >
                      {i.squadra.nome}
                    </Link>
                  </td>
                  <td className="p-2 text-neutral-600">{RUOLI[i.ruolo] ?? i.ruolo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
