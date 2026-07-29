import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  creaPersona, creaSeduta, creaSquadra, creaStagione, creaTesseramento,
  inRollback, leggiPresenze, registraPresenza,
} from './harness'

async function scenario(c: Client) {
  const stagione = await creaStagione(c)
  const squadra = await creaSquadra(c, stagione)
  const persona = await creaPersona(c)
  const tesseramento = await creaTesseramento(c, {
    personaId: persona, stagioneId: stagione, squadraId: squadra,
  })
  return { stagione, squadra, tesseramento }
}

describe('sedute_allenamento', () => {
  it('rifiuta due sedute nello stesso giorno senza ora', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: null })
      await expect(
        creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: null }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it('ammette due sedute nello stesso giorno con orari diversi', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: '17:00' })
      await expect(
        creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: '19:00' }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta una squadra di un\'altra stagione', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      await expect(
        creaSeduta(c, { squadraId: squadraDiS1, stagioneId: s2 }),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})

describe('presenze', () => {
  it('rifiuta due righe per lo stesso giocatore nella stessa seduta', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await expect(registraPresenza(c, seduta, tesseramento, 'assente')).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('cancella le presenze quando si cancella la seduta', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await c.query('delete from public.sedute_allenamento where id = $1', [seduta])
      const { rows } = await c.query('select count(*)::int as n from public.presenze')
      expect(rows[0].n).toBe(0)
    }))

  it('rifiuta un giocatore su una seduta di un\'altra squadra', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      const sedutaAltra = await creaSeduta(c, { squadraId: altra, stagioneId: stagione })
      // Insert scritta a mano: registraPresenza ricava squadra_id dalla seduta
      // e non potrebbe produrre la combinazione incoerente.
      await expect(
        c.query(
          `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
           values ($1, $2, $3, 'presente')`,
          [sedutaAltra, tesseramento, squadra],
        ),
      ).rejects.toThrow(/presenze_seduta_di_squadra/)
    }))

  it('rifiuta di spostare un tesseramento con presenze già registrate', () =>
    inRollback(async (c) => {
      // Il vincolo è `deferrable initially deferred`: dentro una transazione
      // che finisce in rollback la verifica non avverrebbe mai e il test
      // passerebbe senza controllare nulla. In produzione la stessa
      // violazione emerge al commit.
      await c.query('set constraints presenze_tesseramento_di_squadra immediate')
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      await expect(
        c.query('update public.tesseramenti set squadra_id = $1 where id = $2', [
          altra,
          tesseramento,
        ]),
      ).rejects.toThrow(/presenze_tesseramento_di_squadra/)
    }))

  it('cancellare una squadra porta via sedute e presenze', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await c.query('delete from public.squadre where id = $1', [squadra])
      const { rows } = await c.query(
        `select (select count(*)::int from public.presenze) as presenze,
                (select count(*)::int from public.sedute_allenamento) as sedute,
                (select squadra_id from public.tesseramenti where id = $1) as squadra_tesseramento,
                -- La stagione deve SOPRAVVIVERE: su una FK multi-colonna un
                -- \`set null\` nudo annullerebbe anche questa, e senza questa
                -- asserzione il difetto resterebbe invisibile.
                (select stagione_id from public.tesseramenti where id = $1) as stagione_tesseramento`,
        [tesseramento],
      )
      expect(rows[0]).toEqual({
        presenze: 0,
        sedute: 0,
        squadra_tesseramento: null,
        stagione_tesseramento: stagione,
      })
    }))
})

describe('v_presenze', () => {
  it('percentuale nulla quando la squadra non ha sedute', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(0)
      expect(s.percentuale).toBeNull()
    }))

  it('conta i quattro stati separatamente', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const stati = ['presente', 'assente', 'giustificato', 'infortunato'] as const
      for (const [i, stato] of stati.entries()) {
        const seduta = await creaSeduta(c, {
          squadraId: squadra, stagioneId: stagione, data: `2026-10-0${i + 1}`,
        })
        await registraPresenza(c, seduta, tesseramento, stato)
      }
      const s = await leggiPresenze(c, tesseramento)
      expect(s).toMatchObject({
        sedute_squadra: 4, presenti: 1, assenti: 1, giustificati: 1, infortuni: 1,
        non_registrate: 0,
      })
      expect(s.percentuale).toBe('25.0')
    }))

  it('le sedute non compilate contano nel denominatore e in non_registrate', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, {
        squadraId: squadra, stagioneId: stagione, data: '2026-10-01',
      })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-08' })
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-15' })
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(3)
      expect(s.presenti).toBe(1)
      expect(s.non_registrate).toBe(2)
      expect(s.percentuale).toBe('33.3')
    }))

  it('chi si tessera a stagione iniziata ha percentuale bassa e non_registrate alto', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      const tardivo = await creaTesseramento(c, {
        personaId: await creaPersona(c, { codiceFiscale: 'TARDIVO' }),
        stagioneId: stagione, squadraId: squadra,
      })
      for (const giorno of ['01', '08', '15', '22']) {
        await creaSeduta(c, {
          squadraId: squadra, stagioneId: stagione, data: `2026-10-${giorno}`,
        })
      }
      const ultima = await creaSeduta(c, {
        squadraId: squadra, stagioneId: stagione, data: '2026-10-29',
      })
      await registraPresenza(c, ultima, tardivo, 'presente')
      const s = await leggiPresenze(c, tardivo)
      expect(s.sedute_squadra).toBe(5)
      expect(s.non_registrate).toBe(4)
      expect(s.percentuale).toBe('20.0')
    }))

  it('non conta le sedute di altre squadre', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01' })
      await creaSeduta(c, { squadraId: altra, stagioneId: stagione, data: '2026-10-02' })
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(1)
    }))
})
