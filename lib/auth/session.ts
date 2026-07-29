import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

export type RuoloApp = Database['public']['Enums']['ruolo_app']
export type Sessione = { userId: string; ruolo: RuoloApp; personaId: string | null }

export class ErroreAutorizzazione extends Error {
  constructor(messaggio = 'Operazione non consentita') {
    super(messaggio)
    this.name = 'ErroreAutorizzazione'
  }
}

/** Sessione applicativa: utente Auth più profilo attivo. Null se manca uno dei due. */
export async function getSessione(db: SupabaseClient<Database>): Promise<Sessione | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('profili')
    .select('ruolo, persona_id')
    .eq('id', user.id)
    .eq('attivo', true)
    .maybeSingle()

  if (!data) return null
  return { userId: user.id, ruolo: data.ruolo, personaId: data.persona_id }
}

/**
 * Autorizzazione applicativa. Va invocata come prima riga utile di ogni
 * Server Action: dà un errore leggibile dove le RLS darebbero un 42501.
 */
export async function richiediRuolo(
  db: SupabaseClient<Database>,
  ruoli: RuoloApp[],
): Promise<Sessione> {
  const sessione = await getSessione(db)
  if (!sessione) throw new ErroreAutorizzazione('Sessione assente')
  if (!ruoli.includes(sessione.ruolo)) {
    throw new ErroreAutorizzazione('Ruolo non autorizzato per questa operazione')
  }
  return sessione
}
