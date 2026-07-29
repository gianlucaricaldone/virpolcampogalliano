import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ErroreAutorizzazione, getSessione, richiediRuolo } from '@/lib/auth/session'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function clientServizio() {
  return createClient<Database>(URL, SERVICE, { auth: { persistSession: false } })
}

/** Crea un utente reale via API di Auth e restituisce un client autenticato. */
async function clientPerRuolo(ruolo: 'admin' | 'dirigente' | 'allenatore') {
  const servizio = clientServizio()
  const email = `${ruolo}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`
  const password = 'password-di-prova-123'
  const { data: creato, error } = await servizio.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error

  let personaId: string | null = null
  if (ruolo === 'allenatore') {
    const { data } = await servizio
      .from('persone')
      .insert({ nome: 'Mister', cognome: 'Prova', data_nascita: '1980-01-01' })
      .select('id').single()
    personaId = data!.id
  }
  await servizio.from('profili').insert({ id: creato.user.id, ruolo, persona_id: personaId })

  const utente = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
  const { error: erroreAccesso } = await utente.auth.signInWithPassword({ email, password })
  if (erroreAccesso) throw erroreAccesso
  return { db: utente, userId: creato.user.id, personaId, servizio }
}

describe('getSessione', () => {
  it('restituisce null senza sessione', async () => {
    const anonimo = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
    expect(await getSessione(anonimo)).toBeNull()
  })

  it('restituisce ruolo e persona per un allenatore', async () => {
    const { db, userId, personaId } = await clientPerRuolo('allenatore')
    expect(await getSessione(db)).toEqual({ userId, ruolo: 'allenatore', personaId })
  })

  it('restituisce null se il profilo è disattivato', async () => {
    const { db, userId, servizio } = await clientPerRuolo('dirigente')
    await servizio.from('profili').update({ attivo: false }).eq('id', userId)
    expect(await getSessione(db)).toBeNull()
  })
})

describe('richiediRuolo', () => {
  it('passa quando il ruolo è fra quelli ammessi', async () => {
    const { db, userId } = await clientPerRuolo('dirigente')
    const sessione = await richiediRuolo(db, ['admin', 'dirigente'])
    expect(sessione.userId).toBe(userId)
  })

  it('lancia ErroreAutorizzazione quando il ruolo non basta', async () => {
    const { db } = await clientPerRuolo('allenatore')
    await expect(richiediRuolo(db, ['admin', 'dirigente'])).rejects.toBeInstanceOf(
      ErroreAutorizzazione,
    )
  })

  it('lancia ErroreAutorizzazione senza sessione', async () => {
    const anonimo = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
    await expect(richiediRuolo(anonimo, ['admin'])).rejects.toBeInstanceOf(ErroreAutorizzazione)
  })
})
