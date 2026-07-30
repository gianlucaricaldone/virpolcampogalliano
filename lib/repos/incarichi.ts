import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type RuoloStaff = Database['public']['Enums']['ruolo_staff']

export type Incarico = {
  id: string
  ruolo: RuoloStaff
  persona: { id: string; cognome: string; nome: string }
}

export const RUOLI_STAFF: { valore: RuoloStaff; etichetta: string }[] = [
  { valore: 'allenatore', etichetta: 'Allenatore' },
  { valore: 'vice_allenatore', etichetta: 'Vice allenatore' },
  { valore: 'dirigente_squadra', etichetta: 'Dirigente di squadra' },
]

const CAMPI = `
  id, ruolo,
  persona:persone!incarichi_staff_persona_id_fkey (id, cognome, nome)
`

/**
 * Una riga per incarico: sostituisce le colonne allenatore_id,
 * vice_allenatore_1_id e vice_allenatore_2_id del vecchio schema, che
 * ponevano un tetto arbitrario a due vice.
 */
export async function elencaIncarichi(db: Db, squadraId: string): Promise<Incarico[]> {
  const { data, error } = await db.from('incarichi_staff').select(CAMPI).eq('squadra_id', squadraId)
  if (error) throw error
  return data
    .map((r) => ({
      id: r.id,
      ruolo: r.ruolo,
      persona: { id: r.persona.id, cognome: r.persona.cognome, nome: r.persona.nome },
    }))
    .sort(
      (a, b) =>
        a.persona.cognome.localeCompare(b.persona.cognome, 'it') ||
        a.persona.nome.localeCompare(b.persona.nome, 'it'),
    )
}

export async function creaIncarico(
  db: Db,
  dati: { personaId: string; stagioneId: string; squadraId: string; ruolo: RuoloStaff },
): Promise<Incarico> {
  const { data, error } = await db
    .from('incarichi_staff')
    .insert({
      persona_id: dati.personaId,
      stagione_id: dati.stagioneId,
      squadra_id: dati.squadraId,
      ruolo: dati.ruolo,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return {
    id: data.id,
    ruolo: data.ruolo,
    persona: { id: data.persona.id, cognome: data.persona.cognome, nome: data.persona.nome },
  }
}

export async function rimuoviIncarico(db: Db, id: string): Promise<void> {
  const { error } = await db.from('incarichi_staff').delete().eq('id', id)
  if (error) throw error
}
