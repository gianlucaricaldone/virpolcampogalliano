import Link from 'next/link'
import { formattaData } from '@/lib/domain/data'
import type { Tesserato } from '@/lib/repos/tesseramenti'

export function TabellaTesserati({
  tesserati,
  codiceStagione,
  mostraSquadra = true,
}: {
  tesserati: Tesserato[]
  codiceStagione: string
  mostraSquadra?: boolean
}) {
  if (tesserati.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessun tesserato corrisponde a questi filtri.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Tesserato</th>
          <th className="p-2">Nascita</th>
          {mostraSquadra && <th className="p-2">Squadra</th>}
          <th className="p-2">Maglia</th>
        </tr>
      </thead>
      <tbody>
        {tesserati.map((t) => (
          <tr key={t.id} className="border-t">
            <td className="p-2 font-medium">
              <Link href={`/${codiceStagione}/tesseramenti/${t.id}`} className="underline">
                {t.persona.cognome} {t.persona.nome}
              </Link>
            </td>
            <td className="p-2 text-neutral-600">{formattaData(t.persona.dataNascita)}</td>
            {mostraSquadra && (
              <td className="p-2 text-neutral-600">
                {t.squadra ? (
                  <Link href={`/${codiceStagione}/squadre/${t.squadra.id}`} className="underline">
                    {t.squadra.nome}
                  </Link>
                ) : (
                  <span className="text-neutral-500">senza squadra</span>
                )}
              </td>
            )}
            <td className="p-2 text-neutral-600">{t.numeroMaglia ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
