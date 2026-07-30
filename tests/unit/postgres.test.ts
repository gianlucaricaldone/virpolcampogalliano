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

  it('distingue i due significati di un 23503', () => {
    // Stesso codice, cause opposte: una FK composita violata non è una riga
    // sparita, e "ricarica la pagina" manderebbe l'utente a ricaricare in
    // eterno senza mai capire che deve cancellare le presenze.
    const composita = {
      code: '23503',
      message: 'insert or update on table "tesseramenti" violates foreign key constraint "presenze_tesseramento_di_squadra"',
    }
    expect(traduciErrorePostgres(composita)).toMatch(/presenze registrate/i)

    const sparita = {
      code: '23503',
      message: 'insert or update on table "x" violates foreign key constraint "x_y_fkey"',
    }
    expect(traduciErrorePostgres(sparita)).toMatch(/ricarica la pagina/i)
  })

  it('restituisce null per un errore che non conosce', () => {
    expect(traduciErrorePostgres({ code: '08006', message: 'connection failure' })).toBeNull()
  })

  it('restituisce null per un valore che non è un errore Postgres', () => {
    expect(traduciErrorePostgres(new Error('boom'))).toBeNull()
  })
})
