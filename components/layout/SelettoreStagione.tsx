'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import type { Stagione } from '@/lib/repos/stagioni'

/** Cambia solo il segmento di stagione nell'URL: nessuno stato globale. */
export function SelettoreStagione({
  stagioni,
  corrente,
}: {
  stagioni: Stagione[]
  corrente: string
}) {
  const router = useRouter()
  const percorso = usePathname()
  const params = useParams<{ stagione: string }>()

  function cambia(codice: string) {
    const attuale = params.stagione
    router.push(percorso.replace(`/${attuale}`, `/${codice}`))
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-600">Stagione</span>
      <select
        value={corrente}
        onChange={(e) => cambia(e.target.value)}
        className="rounded-md border bg-white px-3 text-sm"
      >
        {stagioni.map((s) => (
          <option key={s.codice} value={s.codice}>
            {s.etichetta}{s.stato === 'chiusa' ? ' (chiusa)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
