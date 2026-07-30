import { notFound } from 'next/navigation'
import { SelettoreStagione } from '@/components/layout/SelettoreStagione'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'
import { caricaStagione } from './dati'

export default async function LayoutStagione({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  const stagione = await caricaStagione(codice)
  if (!stagione) notFound()

  const db = await supabaseServer()
  const stagioni = await elencaStagioni(db)
  const solaLettura = stagione.stato === 'chiusa'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
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
