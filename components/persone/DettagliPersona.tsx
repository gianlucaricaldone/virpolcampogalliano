import { formattaData } from '@/lib/domain/data'
import type { Persona } from '@/lib/repos/persone'

function Voce({ etichetta, valore }: { etichetta: string; valore: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{etichetta}</dt>
      <dd className="text-sm">{valore ?? '—'}</dd>
    </div>
  )
}

/** Scheda in sola lettura: è ciò che vede un allenatore sui propri tesserati. */
export function DettagliPersona({ persona }: { persona: Persona }) {
  const indirizzo = [persona.indirizzo, persona.cap, persona.citta, persona.provincia]
    .filter(Boolean)
    .join(' ')

  return (
    <dl className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <Voce etichetta="Data di nascita" valore={formattaData(persona.dataNascita)} />
      <Voce etichetta="Codice fiscale" valore={persona.codiceFiscale} />
      <Voce etichetta="Email" valore={persona.email} />
      <Voce etichetta="Telefono" valore={persona.telefono} />
      <Voce etichetta="Indirizzo" valore={indirizzo || null} />
      <Voce etichetta="Note" valore={persona.note} />
    </dl>
  )
}
