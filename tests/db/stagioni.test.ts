import { describe, expect, it } from 'vitest'
import { creaSquadra, creaStagione, inRollback } from './harness'

describe('stagioni', () => {
  it('accetta un codice nella forma 2026-27', () =>
    inRollback(async (c) => {
      await expect(creaStagione(c, { codice: '2026-27' })).resolves.toBeTruthy()
    }))

  it.each(['2026/2027', '2026-2027', 'anagrafica', 'admin', '26-27'])(
    'rifiuta il codice %s',
    (codice) =>
      inRollback(async (c) => {
        await expect(creaStagione(c, { codice })).rejects.toThrow(/stagioni_codice_forma/)
      }),
  )

  it('rifiuta una data di fine precedente a quella di inizio', () =>
    inRollback(async (c) => {
      await expect(
        creaStagione(c, { dataInizio: '2026-09-01', dataFine: '2026-08-31' }),
      ).rejects.toThrow(/stagioni_date_coerenti/)
    }))

  it('rifiuta due stagioni con lo stesso codice', () =>
    inRollback(async (c) => {
      await creaStagione(c, { codice: '2026-27' })
      await expect(creaStagione(c, { codice: '2026-27' })).rejects.toThrow(/duplicate key/)
    }))

  it('nasce aperta', () =>
    inRollback(async (c) => {
      const id = await creaStagione(c)
      const { rows } = await c.query('select stato from public.stagioni where id = $1', [id])
      expect(rows[0].stato).toBe('aperta')
    }))
})

describe('squadre', () => {
  it('rifiuta due squadre con lo stesso nome nella stessa stagione', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      await creaSquadra(c, stagione, { nome: 'Pulcini A' })
      await expect(creaSquadra(c, stagione, { nome: 'Pulcini A' })).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('ammette lo stesso nome in due stagioni diverse', () =>
    inRollback(async (c) => {
      const a = await creaStagione(c, { codice: '2025-26' })
      const b = await creaStagione(c, { codice: '2026-27' })
      await creaSquadra(c, a, { nome: 'Pulcini A' })
      await expect(creaSquadra(c, b, { nome: 'Pulcini A' })).resolves.toBeTruthy()
    }))

  it('impedisce di cancellare una stagione che ha squadre', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      await creaSquadra(c, stagione)
      await expect(
        c.query('delete from public.stagioni where id = $1', [stagione]),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})
