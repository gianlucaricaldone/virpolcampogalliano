import { describe, expect, it } from 'vitest'
import { asAnon, inRollback } from './harness'

/**
 * v_squadre_pubbliche è l'unica view non security_invoker del repo: serve
 * anon, che sulle tabelle non ha diritti. Il recinto sta nella definizione
 * (tre colonne, sola stagione corrente) e nel grant. Questi test lo tengono.
 */
describe('v_squadre_pubbliche', () => {
  it('espone le squadre della sola stagione corrente, con le sole tre colonne', () =>
    inRollback(async (c) => {
      await c.query(`
        insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato) values
        ('2098-99', 'Vecchia', '2098-09-01', '2099-06-30', 'chiusa'),
        ('2099-00', 'Corrente', '2099-09-01', '2100-06-30', 'aperta')
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria, annata)
        select id, 'Pubblica', 'Esordienti', 2088 from public.stagioni where codice = '2099-00'
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Fantasma', 'Esordienti' from public.stagioni where codice = '2098-99'
      `)

      const { rows } = await asAnon(c, () =>
        c.query(`select * from public.v_squadre_pubbliche where nome in ('Pubblica', 'Fantasma')`),
      )
      expect(rows).toEqual([{ nome: 'Pubblica', categoria: 'Esordienti', annata: 2088 }])
    }))

  it('a parità di data vince il codice più alto, come stagioneCorrenteDa', () =>
    inRollback(async (c) => {
      await c.query(`
        insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato) values
        ('2099-00', 'Prima', '2099-09-01', '2100-06-30', 'aperta'),
        ('2100-01', 'Seconda', '2099-09-01', '2100-06-30', 'aperta')
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Vincente', 'Pulcini' from public.stagioni where codice = '2100-01'
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Perdente', 'Pulcini' from public.stagioni where codice = '2099-00'
      `)
      const { rows } = await asAnon(c, () =>
        c.query(`select nome from public.v_squadre_pubbliche where nome in ('Vincente', 'Perdente')`),
      )
      expect(rows).toEqual([{ nome: 'Vincente' }])
    }))

  it('anon legge la view ma continua a non leggere le tabelle', () =>
    inRollback(async (c) => {
      // Savepoint attorno ai dinieghi: quando una query fallisce per RLS aborta
      // la transazione. Senza savepoint il secondo rifiuto troverebbe "current
      // transaction is aborted" invece del diniego che sta verificando.
      await c.query('savepoint rls_squadre')
      await expect(
        asAnon(c, () => c.query('select nome from public.squadre limit 1')),
      ).rejects.toThrow(/permission denied/i)
      await c.query('rollback to savepoint rls_squadre')

      await c.query('savepoint rls_stagioni')
      await expect(
        asAnon(c, () => c.query('select codice from public.stagioni limit 1')),
      ).rejects.toThrow(/permission denied/i)
      await c.query('rollback to savepoint rls_stagioni')
    }))

  it('senza stagioni aperte la view è vuota, non rotta', () =>
    inRollback(async (c) => {
      await c.query(`update public.stagioni set stato = 'chiusa'`)
      const { rows } = await asAnon(c, () => c.query('select * from public.v_squadre_pubbliche'))
      expect(rows).toEqual([])
    }))
})
