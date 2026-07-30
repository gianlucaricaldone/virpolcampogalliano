import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  creaPersona, creaSquadra, creaStagione, creaTesseramento,
  impostaQuota, inRollback, leggiQuota, registraPagamento,
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

describe('quote_importi', () => {
  it('rifiuta una riga che non indica esattamente un livello', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await expect(
        c.query(
          `insert into public.quote_importi (stagione_id, squadra_id, importo)
           values ($1, $2, 250)`,
          [stagione, squadra],
        ),
      ).rejects.toThrow(/quote_importi_un_solo_livello/)
    }))

  it('rifiuta una riga senza nessun livello', () =>
    inRollback(async (c) => {
      await expect(
        c.query(`insert into public.quote_importi (importo) values (250)`),
      ).rejects.toThrow(/quote_importi_un_solo_livello/)
    }))

  it('ammette un solo importo per stagione', () =>
    inRollback(async (c) => {
      const { stagione } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await expect(impostaQuota(c, { stagioneId: stagione, importo: 300 })).rejects.toThrow(
        /duplicate key/,
      )
    }))
})

describe('v_quote — risoluzione dell\'importo atteso', () => {
  it('usa il default della stagione quando non ci sono override', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('250.00')
    }))

  it('l\'override di squadra vince sul default di stagione', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('280.00')
    }))

  it('l\'override del tesseramento vince su tutti', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      await impostaQuota(c, { tesseramentoId: tesseramento, importo: 125 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('125.00')
    }))
})

describe('v_quote — livello che determina l\'importo', () => {
  it('dice quale dei tre livelli sta decidendo', () =>
    inRollback(async (c) => {
      // Senza questo campo un override di squadra sembra un errore di calcolo
      // del default di stagione, e chi lo vede cerca un bug che non c'è.
      const { stagione, squadra, tesseramento } = await scenario(c)
      expect((await leggiQuota(c, tesseramento)).livello_importo).toBe('nessuno')

      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      expect((await leggiQuota(c, tesseramento)).livello_importo).toBe('stagione')

      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      expect((await leggiQuota(c, tesseramento)).livello_importo).toBe('squadra')

      await impostaQuota(c, { tesseramentoId: tesseramento, importo: 125 })
      expect((await leggiQuota(c, tesseramento)).livello_importo).toBe('tesseramento')
    }))

  it('resta coerente con l\'importo che espone', () =>
    inRollback(async (c) => {
      // I due campi nascono dallo stesso ordine di precedenza: se qualcuno
      // cambiasse il coalesce senza toccare il case, direbbero cose diverse.
      const { stagione, squadra, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      const q = await leggiQuota(c, tesseramento)
      expect(q).toMatchObject({ quota_attesa: '280.00', livello_importo: 'squadra' })
    }))
})

describe('v_quote — stato', () => {
  it('non_pagato senza versamenti', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('non_pagato')
      expect(q.residuo).toBe('250.00')
    }))

  it('parziale con metà quota versata', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 125)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('parziale')
      expect(q.residuo).toBe('125.00')
    }))

  it('saldato con due versamenti che coprono la quota', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 125)
      await registraPagamento(c, tesseramento, 125)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('saldato')
      expect(q.residuo).toBe('0.00')
    }))

  it('saldato con residuo negativo quando si versa più del dovuto', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 300)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('saldato')
      expect(q.residuo).toBe('-50.00')
    }))

  it('saldato quando nessuna quota è configurata', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      const q = await leggiQuota(c, tesseramento)
      expect(q.quota_attesa).toBe('0.00')
      expect(q.stato).toBe('saldato')
    }))

  it('usa il default di stagione anche per un tesserato senza squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const persona = await creaPersona(c)
      const tesseramento = await creaTesseramento(c, {
        personaId: persona, stagioneId: stagione, squadraId: null,
      })
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('250.00')
    }))
})

describe('pagamenti_quota', () => {
  it('rifiuta un importo non positivo', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      await expect(registraPagamento(c, tesseramento, 0)).rejects.toThrow(
        /pagamenti_importo_positivo/,
      )
    }))

  it('cancella i pagamenti quando si cancella il tesseramento', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      await registraPagamento(c, tesseramento, 100)
      await c.query('delete from public.tesseramenti where id = $1', [tesseramento])
      const { rows } = await c.query(
        'select count(*)::int as n from public.pagamenti_quota where tesseramento_id = $1',
        [tesseramento],
      )
      expect(rows[0].n).toBe(0)
    }))
})
