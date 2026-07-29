import { describe, expect, it } from 'vitest'
import { creaPersona, creaUtenteAuth, inRollback } from './harness'

describe('persone', () => {
  it('accetta una persona con i soli campi obbligatori', () =>
    inRollback(async (c) => {
      const id = await creaPersona(c)
      const { rows } = await c.query('select attiva from public.persone where id = $1', [id])
      expect(rows[0].attiva).toBe(true)
    }))

  it('rifiuta due persone con lo stesso codice fiscale', () =>
    inRollback(async (c) => {
      await creaPersona(c, { codiceFiscale: 'RSSMRA12E14A000X' })
      await expect(creaPersona(c, { codiceFiscale: 'RSSMRA12E14A000X' })).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('ammette più persone senza codice fiscale', () =>
    inRollback(async (c) => {
      await creaPersona(c, { codiceFiscale: undefined })
      await expect(creaPersona(c, { codiceFiscale: undefined })).resolves.toBeTruthy()
    }))
})

describe('profili', () => {
  it('impedisce un allenatore senza persona collegata', () =>
    inRollback(async (c) => {
      await expect(creaUtenteAuth(c, { ruolo: 'allenatore' })).rejects.toThrow(
        /profili_allenatore_ha_persona/,
      )
    }))

  it('ammette un allenatore con persona collegata', () =>
    inRollback(async (c) => {
      const persona = await creaPersona(c)
      await expect(
        creaUtenteAuth(c, { ruolo: 'allenatore', personaId: persona }),
      ).resolves.toBeTruthy()
    }))

  it('ammette un admin senza persona collegata', () =>
    inRollback(async (c) => {
      await expect(creaUtenteAuth(c, { ruolo: 'admin' })).resolves.toBeTruthy()
    }))
})
