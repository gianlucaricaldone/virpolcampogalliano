import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ElencoSedute } from '@/components/presenze/ElencoSedute'
import { FormSeduta } from '@/components/presenze/FormSeduta'
import { elencaSedute } from '@/lib/repos/presenze'
import { elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { stagioneRichiesta } from '../../dati'
import { caricaSquadra } from '../../squadre/[squadraId]/dati'
import { creaSedutaAzione } from '../actions'

export default async function PaginaSeduteSquadra({
  params,
}: {
  params: Promise<{ stagione: string; squadraId: string }>
}) {
  const { stagione: codice, squadraId } = await params
  const stagione = await stagioneRichiesta(codice)
  const squadra = await caricaSquadra(squadraId)
  if (!squadra) notFound()

  const db = await supabaseServer()
  const sedute = await elencaSedute(db, squadraId)
  const rosa = await elencaTesseramenti(db, stagione.id, { squadraId })
  const modificabile = stagione.stato === 'aperta'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Allenamenti · {squadra.nome}</h1>
        <Link href={`/${codice}/presenze`} className="text-sm underline">
          Torna alle squadre
        </Link>
      </div>

      {modificabile ? (
        <FormSeduta
          azione={creaSedutaAzione.bind(null, codice, squadraId)}
          oggi={new Date().toISOString().slice(0, 10)}
        />
      ) : (
        <p className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
          Stagione chiusa: le sedute sono in sola lettura.
        </p>
      )}

      <ElencoSedute
        sedute={sedute}
        codiceStagione={codice}
        squadraId={squadraId}
        totaleRosa={rosa.length}
      />
    </section>
  )
}
