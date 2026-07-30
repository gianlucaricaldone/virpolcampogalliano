import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FoglioPresenze } from '@/components/presenze/FoglioPresenze'
import { PulsanteRimuoviSeduta } from '@/components/presenze/PulsanteRimuoviSeduta'
import { formattaData } from '@/lib/domain/data'
import { stagioneRichiesta } from '../../../dati'
import { rimuoviSedutaAzione, salvaPresenzeAzione } from '../../actions'
import { caricaFoglio } from './dati'

export default async function PaginaFoglio({
  params,
}: {
  params: Promise<{ stagione: string; squadraId: string; sedutaId: string }>
}) {
  const { stagione: codice, squadraId, sedutaId } = await params
  const stagione = await stagioneRichiesta(codice)
  // Il layout ha già deciso il 404: qui si legge dalla cache di richiesta.
  const foglio = await caricaFoglio(sedutaId)
  if (!foglio) notFound()

  // Su stagione chiusa le policy negano la scrittura: il foglio si mostra in
  // sola lettura invece di scoprirlo con un errore al primo click.
  const modificabile = stagione.stato === 'aperta'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {foglio.squadra.nome} · {formattaData(foglio.seduta.data)}
          </h1>
          <p className="text-sm text-neutral-600">
            {foglio.seduta.oraInizio?.slice(0, 5) ?? 'senza ora'}
            {foglio.seduta.note ? ` · ${foglio.seduta.note}` : ''}
          </p>
        </div>
        <Link href={`/${codice}/presenze/${squadraId}`} className="text-sm underline">
          Torna alle sedute
        </Link>
      </div>

      {foglio.righe.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-neutral-600">
          Nessun tesserato in questa squadra: il foglio è vuoto finché non ci sono giocatori.
        </p>
      ) : (
        <FoglioPresenze
          righe={foglio.righe}
          salva={salvaPresenzeAzione.bind(null, codice, squadraId, sedutaId)}
          modificabile={modificabile}
        />
      )}

      {modificabile && (
        <PulsanteRimuoviSeduta
          azione={rimuoviSedutaAzione.bind(null, codice, squadraId, sedutaId)}
        />
      )}
    </section>
  )
}
