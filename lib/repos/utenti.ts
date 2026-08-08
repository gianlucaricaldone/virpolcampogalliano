import type { SupabaseClient } from '@supabase/supabase-js'
import type { RuoloApp } from '@/lib/auth/session'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type Utente = {
  id: string
  email: string
  ruolo: RuoloApp
  attivo: boolean
  persona: { id: string; cognome: string; nome: string } | null
}

/**
 * L'elenco passa da una funzione SECURITY DEFINER e non da una select: l'email
 * vive in auth.users, che `authenticated` non può leggere. La funzione nega a
 * chi non è admin sollevando 42501, quindi qui non serve nessun controllo.
 */
export async function elencaUtenti(db: Db): Promise<Utente[]> {
  const { data, error } = await db.rpc('elenco_utenti')
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    ruolo: r.ruolo,
    attivo: r.attivo,
    persona:
      r.persona_id && r.persona_cognome && r.persona_nome
        ? { id: r.persona_id, cognome: r.persona_cognome, nome: r.persona_nome }
        : null,
  }))
}

export async function creaProfilo(
  db: Db,
  dati: { id: string; ruolo: RuoloApp; personaId: string | null },
): Promise<void> {
  const { error } = await db
    .from('profili')
    .insert({ id: dati.id, ruolo: dati.ruolo, persona_id: dati.personaId })
  if (error) throw error
}

/**
 * Ruolo, persona e stato in **una** UPDATE. Promuovere qualcuno ad allenatore
 * significa cambiare ruolo e collegare la persona nello stesso gesto: in due
 * scritture la prima passerebbe e la seconda verrebbe respinta da
 * profili_allenatore_ha_persona, lasciando un profilo che non sta in piedi.
 */
export async function aggiornaProfilo(
  db: Db,
  id: string,
  dati: { ruolo?: RuoloApp; personaId?: string | null; attivo?: boolean },
): Promise<void> {
  const riga: Database['public']['Tables']['profili']['Update'] = {}
  if (dati.ruolo !== undefined) riga.ruolo = dati.ruolo
  if (dati.personaId !== undefined) riga.persona_id = dati.personaId
  if (dati.attivo !== undefined) riga.attivo = dati.attivo

  const { error } = await db.from('profili').update(riga).eq('id', id)
  if (error) throw error
}
