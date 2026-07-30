import Link from 'next/link'
import { formattaData } from '@/lib/domain/data'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { Tabella } from '../ui/Tabella'

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
      <p className="rounded-lg border bg-white p-4 text-neutral-600">
        Nessun tesserato corrisponde a questi filtri.
      </p>
    )
  }

  return (
    <Tabella>
      <thead className="text-left">
        <tr>
          <th>Tesserato</th>
          <th>Nascita</th>
          {mostraSquadra && <th>Squadra</th>}
          <th>Maglia</th>
        </tr>
      </thead>
      <tbody>
        {tesserati.map((t) => (
          <tr key={t.id}>
            <td className="font-medium">
              <Link href={`/${codiceStagione}/tesseramenti/${t.id}`} className="underline">
                {t.persona.cognome} {t.persona.nome}
              </Link>
            </td>
            <td className="text-neutral-600">{formattaData(t.persona.dataNascita)}</td>
            {mostraSquadra && (
              <td className="text-neutral-600">
                {t.squadra ? (
                  <Link href={`/${codiceStagione}/squadre/${t.squadra.id}`} className="underline">
                    {t.squadra.nome}
                  </Link>
                ) : (
                  <span className="text-neutral-500">senza squadra</span>
                )}
              </td>
            )}
            <td className="text-neutral-600">{t.numeroMaglia ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </Tabella>
  )
}
