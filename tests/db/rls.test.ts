import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  asAnon, asUser, creaIncarico, creaPersona, creaSeduta, creaSquadra, creaStagione,
  creaTesseramento, creaUtenteAuth, impostaQuota, inRollback, registraPagamento,
} from './harness'

/**
 * Due squadre nella stessa stagione. L'allenatore ha un incarico solo su A.
 * È lo scenario su cui si misura ogni diniego.
 */
async function dueSquadre(c: Client) {
  const stagione = await creaStagione(c, { codice: '2026-27' })
  const squadraA = await creaSquadra(c, stagione, { nome: 'A' })
  const squadraB = await creaSquadra(c, stagione, { nome: 'B' })

  const personaMister = await creaPersona(c, { codiceFiscale: 'MISTER' })
  await creaIncarico(c, { personaId: personaMister, stagioneId: stagione, squadraId: squadraA })
  const mister = await creaUtenteAuth(c, { ruolo: 'allenatore', personaId: personaMister })
  const dirigente = await creaUtenteAuth(c, { ruolo: 'dirigente' })
  const admin = await creaUtenteAuth(c, { ruolo: 'admin' })

  const giocatoreA = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-A' }),
    stagioneId: stagione, squadraId: squadraA,
  })
  const giocatoreB = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-B' }),
    stagioneId: stagione, squadraId: squadraB,
  })
  const sedutaA = await creaSeduta(c, { squadraId: squadraA, stagioneId: stagione, data: '2026-10-01' })
  const sedutaB = await creaSeduta(c, { squadraId: squadraB, stagioneId: stagione, data: '2026-10-01' })

  return { stagione, squadraA, squadraB, mister, dirigente, admin, giocatoreA, giocatoreB, sedutaA, sedutaB }
}

async function conta(c: Client, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await c.query(sql, params)
  return rows.length
}

describe('funzioni helper', () => {
  it('mio_ruolo legge il ruolo del profilo corrente', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBe('dirigente')
    }))

  it('mie_squadre restituisce solo le squadre con incarico', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const squadre = await asUser(c, mister, async () => {
        const { rows } = await c.query('select * from app.mie_squadre() as s')
        return rows.map((r) => r.s)
      })
      expect(squadre).toEqual([squadraA])
    }))

  it('un profilo disattivato non ha ruolo', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await c.query('update public.profili set attivo = false where id = $1', [dirigente])
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBeNull()
    }))
})

describe('allenatore — lettura', () => {
  it('vede i tesseramenti della propria squadra', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('NON vede i tesseramenti della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le persone della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, `select id from public.persone where codice_fiscale = 'GIOC-B'`),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le sedute della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))
})

describe('allenatore — scrittura', () => {
  it('inserisce presenze sulla propria seduta', () =>
    inRollback(async (c) => {
      const { mister, squadraA, sedutaA, giocatoreA } = await dueSquadre(c)
      await asUser(c, mister, async () => {
        await c.query(
          `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
           values ($1, $2, $3, 'presente')`,
          [sedutaA, giocatoreA, squadraA],
        )
      })
      const { rows } = await c.query('select count(*)::int as n from public.presenze')
      expect(rows[0].n).toBe(1)
    }))

  it('NON inserisce presenze sulla seduta della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB, sedutaB, giocatoreB } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
             values ($1, $2, $3, 'presente')`,
            [sedutaB, giocatoreB, squadraB],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON modifica i tesseramenti', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      const esito = await asUser(c, mister, () =>
        c.query('update public.tesseramenti set numero_maglia = 7 where id = $1', [giocatoreA]),
      )
      expect(esito.rowCount).toBe(0) // nessuna riga aggiornabile: la USING non passa
    }))

  it('NON crea squadre', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('allenatore — dati finanziari', () => {
  it('NON legge quote_importi', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      const n = await asUser(c, mister, () => conta(c, 'select id from public.quote_importi'))
      expect(n).toBe(0)
    }))

  it('NON legge pagamenti_quota', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      await registraPagamento(c, giocatoreA, 125)
      const n = await asUser(c, mister, () => conta(c, 'select id from public.pagamenti_quota'))
      expect(n).toBe(0)
    }))

  it('da v_quote non ricava cifre reali', () =>
    inRollback(async (c) => {
      const { mister, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, mister, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '0.00', pagato: '0.00', stato: 'saldato' })
    }))

  it('il dirigente legge le cifre reali', () =>
    inRollback(async (c) => {
      const { dirigente, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, dirigente, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '250.00', pagato: '125.00', stato: 'parziale' })
    }))
})

describe('stagione chiusa', () => {
  it('resta leggibile', () =>
    inRollback(async (c) => {
      const { mister, stagione, squadraA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('rifiuta le scritture dell\'allenatore', () =>
    inRollback(async (c) => {
      const { mister, stagione, squadraA, sedutaA, giocatoreA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
             values ($1, $2, $3, 'presente')`,
            [sedutaA, giocatoreA, squadraA],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('rifiuta le scritture del dirigente', () =>
    inRollback(async (c) => {
      const { dirigente, stagione } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Tardiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('dirigente e admin', () => {
  it('il dirigente vede i tesseramenti di tutte le squadre', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const n = await asUser(c, dirigente, () => conta(c, 'select id from public.tesseramenti'))
      expect(n).toBe(2)
    }))

  it('il dirigente NON crea stagioni', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
             values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('l\'admin crea stagioni', () =>
    inRollback(async (c) => {
      const { admin } = await dueSquadre(c)
      await asUser(c, admin, () =>
        c.query(
          `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
           values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
        ),
      )
      const { rows } = await c.query('select count(*)::int as n from public.stagioni')
      expect(rows[0].n).toBe(2)
    }))
})

describe('utente anonimo', () => {
  it('legge stagioni e squadre', () =>
    inRollback(async (c) => {
      await dueSquadre(c)
      const esito = await asAnon(c, async () => ({
        stagioni: await conta(c, 'select id from public.stagioni'),
        squadre: await conta(c, 'select id from public.squadre'),
      }))
      expect(esito).toEqual({ stagioni: 1, squadre: 2 })
    }))

  it.each([
    'persone', 'profili', 'tesseramenti', 'incarichi_staff',
    'sedute_allenamento', 'presenze', 'quote_importi', 'pagamenti_quota',
  ])('NON legge %s', (tabella) =>
    inRollback(async (c) => {
      await dueSquadre(c)
      const n = await asAnon(c, () => conta(c, `select * from public.${tabella}`))
      expect(n).toBe(0)
    }))

  it('NON scrive squadre', () =>
    inRollback(async (c) => {
      const { stagione } = await dueSquadre(c)
      await expect(
        asAnon(c, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security|permission denied/)
    }))
})
