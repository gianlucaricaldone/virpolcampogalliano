import { describe, expect, it } from 'vitest'
import {
  creaIncarico, creaPersona, creaSquadra, creaStagione, creaTesseramento, inRollback,
} from './harness'

describe('tesseramenti', () => {
  it('rifiuta due tesseramenti della stessa persona nella stessa stagione', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadraA = await creaSquadra(c, stagione, { nome: 'A' })
      const squadraB = await creaSquadra(c, stagione, { nome: 'B' })
      const persona = await creaPersona(c)
      await creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadraA })
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadraB }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it('ammette la stessa persona in due stagioni diverse', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const persona = await creaPersona(c)
      await creaTesseramento(c, { personaId: persona, stagioneId: s1 })
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: s2 }),
      ).resolves.toBeTruthy()
    }))

  it('ammette un tesseramento senza squadra assegnata', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: null }),
      ).resolves.toBeTruthy()
    }))

  it("rifiuta una squadra che appartiene a un'altra stagione", () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: s2, squadraId: squadraDiS1 }),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})

describe('numero di maglia', () => {
  it('rifiuta la stessa maglia due volte nella stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: squadra, numeroMaglia: 10 })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: squadra, numeroMaglia: 10 }),
      ).rejects.toThrow(/tesseramenti_squadra_maglia_uidx/)
    }))

  it('ammette la stessa maglia in due squadre diverse', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const sqA = await creaSquadra(c, stagione, { nome: 'A' })
      const sqB = await creaSquadra(c, stagione, { nome: 'B' })
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: sqA, numeroMaglia: 10 })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: sqB, numeroMaglia: 10 }),
      ).resolves.toBeTruthy()
    }))

  it('ammette più tesserati senza numero di maglia nella stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: squadra })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: squadra }),
      ).resolves.toBeTruthy()
    }))

  it("rifiuta un numero fuori dall'intervallo 1-99", () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadra, numeroMaglia: 0 }),
      ).rejects.toThrow(/tesseramenti_maglia_intervallo/)
    }))
})

describe('incarichi staff', () => {
  it('ammette lo stesso allenatore su più squadre', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const sqA = await creaSquadra(c, stagione, { nome: 'A' })
      const sqB = await creaSquadra(c, stagione, { nome: 'B' })
      const persona = await creaPersona(c)
      await creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: sqA })
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: sqB }),
      ).resolves.toBeTruthy()
    }))

  it('ammette più vice allenatori sulla stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaIncarico(c, { personaId: a, stagioneId: stagione, squadraId: squadra, ruolo: 'vice_allenatore' })
      await expect(
        creaIncarico(c, { personaId: b, stagioneId: stagione, squadraId: squadra, ruolo: 'vice_allenatore' }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta lo stesso incarico due volte per la stessa persona e squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const persona = await creaPersona(c)
      await creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: squadra })
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: squadra }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it("rifiuta una squadra di un'altra stagione", () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      const persona = await creaPersona(c)
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: s2, squadraId: squadraDiS1 }),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})
