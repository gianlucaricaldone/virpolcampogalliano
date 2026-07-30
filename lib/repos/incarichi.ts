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

/**
 * Le squadre in cui una persona ha un incarico, nella stagione data.
 *
 * È l'equivalente applicativo di `app.mie_squadre()`, che vive nello schema
 * `app` e non è raggiungibile da PostgREST. Serve alle pagine che devono
 * mostrare a un allenatore le sue squadre e non tutte: `squadre_sel` è
 * `using (true)` — i nomi delle squadre servono al sito pubblico — quindi
 * senza questo filtro un allenatore vedrebbe elenchi su cui non può fare
 * nulla.
 */
export async function squadreDiStaff(
  db: Db,
  personaId: string,
  stagioneId: string,
): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db
    .from('incarichi_staff')
    .select('squadra:squadre!incarichi_squadra_di_stagione (id, nome)')
    .eq('persona_id', personaId)
    .eq('stagione_id', stagioneId)
  if (error) throw error

  // Una persona può avere più incarichi sulla stessa squadra (allenatore e
  // dirigente di squadra): l'elenco va reso distinto.
  const perId = new Map(data.map((r) => [r.squadra.id, r.squadra]))
  return [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
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
