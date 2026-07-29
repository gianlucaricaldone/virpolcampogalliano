import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { elencaStagioni, stagioneCorrente, stagionePerCodice } from '@/lib/repos/stagioni'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } })

beforeEach(async () => {
  await db.from('stagioni').delete().neq('codice', '')
})

async function inserisci(
  codice: string, dataInizio: string, stato: 'aperta' | 'chiusa' = 'aperta',
) {
  const { error } = await db.from('stagioni').insert({
    codice,
    etichetta: etichettaDaCodice(codice),
    data_inizio: dataInizio,
    data_fine: `${Number(dataInizio.slice(0, 4)) + 1}-06-30`,
    stato,
  })
  if (error) throw error
}

describe('stagioneCorrente', () => {
  it('restituisce null quando non ci sono stagioni', async () => {
    expect(await stagioneCorrente(db)).toBeNull()
  })

  it('sceglie la stagione aperta più recente per data di inizio', async () => {
    await inserisci('2025-26', '2025-09-01')
    await inserisci('2026-27', '2026-09-01')
    expect((await stagioneCorrente(db))?.codice).toBe('2026-27')
  })

  it('ignora le stagioni chiuse', async () => {
    await inserisci('2025-26', '2025-09-01', 'aperta')
    await inserisci('2026-27', '2026-09-01', 'chiusa')
    expect((await stagioneCorrente(db))?.codice).toBe('2025-26')
  })

  it('restituisce null se tutte le stagioni sono chiuse', async () => {
    await inserisci('2025-26', '2025-09-01', 'chiusa')
    expect(await stagioneCorrente(db)).toBeNull()
  })
})

describe('stagionePerCodice', () => {
  it('trova la stagione', async () => {
    await inserisci('2026-27', '2026-09-01')
    expect((await stagionePerCodice(db, '2026-27'))?.etichetta).toBe('2026/2027')
  })

  it('restituisce null per un codice inesistente', async () => {
    expect(await stagionePerCodice(db, '1999-00')).toBeNull()
  })
})

describe('elencaStagioni', () => {
  it('ordina dalla più recente alla più vecchia', async () => {
    await inserisci('2024-25', '2024-09-01')
    await inserisci('2026-27', '2026-09-01')
    await inserisci('2025-26', '2025-09-01')
    expect((await elencaStagioni(db)).map((s) => s.codice)).toEqual([
      '2026-27', '2025-26', '2024-25',
    ])
  })
})
