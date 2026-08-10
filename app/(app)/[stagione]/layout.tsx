import { notFound } from 'next/navigation'
import { SelettoreStagione } from '@/components/layout/SelettoreStagione'
import { caricaStagioni } from '../dati'
import { caricaStagione } from './dati'

export default async function LayoutStagione({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  // Il codice dell'URL e l'elenco completo si chiedono insieme. `caricaStagioni`
  // è già stato risolto dal layout sopra, quindi qui costa zero.
  const [stagione, stagioni] = await Promise.all([caricaStagione(codice), caricaStagioni()])
  if (!stagione) notFound()
  const solaLettura = stagione.stato === 'chiusa'

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SelettoreStagione stagioni={stagioni} corrente={stagione.codice} />
        {solaLettura && (
          <p className="rounded bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Stagione chiusa: dati in sola lettura
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
