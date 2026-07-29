import { describe, expect, it } from 'vitest'
import { traduciErrorePostgres } from '@/lib/errors/postgres'

describe('traduciErrorePostgres', () => {
  it('traduce la maglia duplicata', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "tesseramenti_squadra_maglia_uidx"' }
    expect(traduciErrorePostgres(e)).toMatch(/maglia/i)
  })

  it('traduce il doppio tesseramento nella stessa stagione', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "tesseramenti_persona_id_stagione_id_key"' }
    expect(traduciErrorePostgres(e)).toMatch(/già tesserat/i)
  })

  it('traduce la seduta duplicata', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "sedute_squadra_data_ora_key"' }
    expect(traduciErrorePostgres(e)).toMatch(/seduta/i)
  })

  it('traduce il codice stagione malformato', () => {
    const e = { code: '23514', message: 'new row violates check constraint "stagioni_codice_forma"' }
    expect(traduciErrorePostgres(e)).toMatch(/2026-27/)
  })

  it('traduce il rifiuto delle RLS', () => {
    const e = { code: '42501', message: 'new row violates row-level security policy' }
    expect(traduciErrorePostgres(e)).toMatch(/non consentita/i)
  })

  it('restituisce null per un errore che non conosce', () => {
    expect(traduciErrorePostgres({ code: '08006', message: 'connection failure' })).toBeNull()
  })

  it('restituisce null per un valore che non è un errore Postgres', () => {
    expect(traduciErrorePostgres(new Error('boom'))).toBeNull()
  })
})
