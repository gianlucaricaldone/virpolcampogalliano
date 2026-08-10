import { describe, expect, it } from 'vitest'
import {
  asAnon,
  creaIncarico,
  creaPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
  inRollback,
} from './harness'

/**
 * Una stagione più recente di quella del seed, così è lei la corrente e i
 * conteggi contano solo le righe di questo test. Le date del 2099 sono la stessa
 * convenzione dei test su v_squadre_pubbliche qui sotto.
 */
async function stagioneCorrente(c: Parameters<typeof creaStagione>[0], codice = '2099-00') {
  return creaStagione(c, { codice, dataInizio: '2099-09-01', dataFine: '2100-06-30' })
}

/**
 * Le due view del sito pubblico — v_squadre_pubbliche e v_numeri_pubblici — sono
 * le sole del repo senza security_invoker: servono anon, che sulle tabelle non
 * ha diritti, quindi leggono coi diritti del proprietario. Il recinto non sta
 * nelle policy (nessuna nomina anon) ma nella definizione delle view e nel
 * grant. Questi test lo tengono.
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

/**
 * I due numeri della home. Prima erano scritti a mano e falsi: «8 squadre
 * attive» accanto a una pagina che le squadre le legge dal database.
 */
describe('v_numeri_pubblici', () => {
  it('conta squadre e atleti della sola stagione corrente', () =>
    inRollback(async (c) => {
      const corrente = await stagioneCorrente(c)
      const vecchia = await creaStagione(c, { codice: '2098-99', stato: 'chiusa' })
      await creaSquadra(c, corrente, { nome: 'Una' })
      await creaSquadra(c, corrente, { nome: 'Due' })
      await creaSquadra(c, vecchia, { nome: 'Fantasma' })
      await creaTesseramento(c, {
        personaId: await creaPersona(c, { cognome: 'Adesso' }),
        stagioneId: corrente,
      })
      await creaTesseramento(c, {
        personaId: await creaPersona(c, { cognome: 'Allora' }),
        stagioneId: vecchia,
      })

      const { rows } = await asAnon(c, () =>
        c.query('select * from public.v_numeri_pubblici'),
      )
      expect(rows).toEqual([{ squadre: 2, atleti: 1 }])
    }))

  it('non conta fra gli atleti chi ha un incarico di staff nella stessa stagione', () =>
    inRollback(async (c) => {
      const corrente = await stagioneCorrente(c)
      const squadra = await creaSquadra(c, corrente)
      const ragazzo = await creaPersona(c, { cognome: 'Ragazzo' })
      const mister = await creaPersona(c, { cognome: 'Mister' })
      await creaTesseramento(c, { personaId: ragazzo, stagioneId: corrente, squadraId: squadra })
      // Un allenatore tesserato esiste davvero: nella rosa reale sono sei. Se
      // entrasse nel conteggio, «atleti tesserati» sarebbe un numero gonfiato.
      await creaTesseramento(c, { personaId: mister, stagioneId: corrente, squadraId: squadra })
      await creaIncarico(c, { personaId: mister, stagioneId: corrente, squadraId: squadra })

      const { rows } = await asAnon(c, () =>
        c.query('select atleti from public.v_numeri_pubblici'),
      )
      expect(rows).toEqual([{ atleti: 1 }])
    }))

  it('un incarico in una stagione diversa non toglie nessun atleta', () =>
    inRollback(async (c) => {
      const corrente = await stagioneCorrente(c)
      const passata = await creaStagione(c, { codice: '2098-99', stato: 'chiusa' })
      const squadraOra = await creaSquadra(c, corrente, { nome: 'Ora' })
      const squadraPrima = await creaSquadra(c, passata, { nome: 'Prima' })
      const exMister = await creaPersona(c, { cognome: 'ExMister' })
      await creaTesseramento(c, {
        personaId: exMister,
        stagioneId: corrente,
        squadraId: squadraOra,
      })
      await creaIncarico(c, {
        personaId: exMister,
        stagioneId: passata,
        squadraId: squadraPrima,
      })

      // Chi allenava due anni fa e oggi gioca è un atleta: il criterio è
      // correlato sulla stagione, e senza questo test un `not exists` sul solo
      // persona_id passerebbe.
      const { rows } = await asAnon(c, () =>
        c.query('select atleti from public.v_numeri_pubblici'),
      )
      expect(rows).toEqual([{ atleti: 1 }])
    }))

  it('a parità di data vince il codice più alto, come in v_squadre_pubbliche', () =>
    inRollback(async (c) => {
      // La regola della stagione corrente è duplicata fra le due view: questo
      // test è il prezzo della copia, e senza di lui la copia non ha nulla che
      // la pinni.
      const prima = await stagioneCorrente(c, '2099-00')
      const seconda = await stagioneCorrente(c, '2100-01')
      await creaSquadra(c, prima, { nome: 'Perdente' })
      await creaSquadra(c, seconda, { nome: 'Vincente A' })
      await creaSquadra(c, seconda, { nome: 'Vincente B' })

      const { rows } = await asAnon(c, () =>
        c.query('select squadre from public.v_numeri_pubblici'),
      )
      expect(rows).toEqual([{ squadre: 2 }])
    }))

  it('senza stagioni aperte non restituisce nessuna riga, non una riga di zeri', () =>
    inRollback(async (c) => {
      await c.query(`update public.stagioni set stato = 'chiusa'`)
      const { rows } = await asAnon(c, () => c.query('select * from public.v_numeri_pubblici'))
      // Zero righe e non `[{ squadre: 0, atleti: 0 }]`: è così che la home
      // distingue «non c'è una stagione» da «la stagione è vuota» e nasconde la
      // sezione invece di pubblicare uno zero.
      expect(rows).toEqual([])
    }))

  it('anon legge i numeri ma continua a non leggere tesseramenti e incarichi', () =>
    inRollback(async (c) => {
      const corrente = await stagioneCorrente(c)
      const squadra = await creaSquadra(c, corrente)
      await creaTesseramento(c, {
        personaId: await creaPersona(c, { cognome: 'Visibile' }),
        stagioneId: corrente,
        squadraId: squadra,
      })

      // Il permesso prima dei dinieghi, e con conteggi maggiori di zero: se
      // l'impersonificazione si rompesse, un test di solo diniego passerebbe.
      const { rows } = await asAnon(c, () =>
        c.query('select squadre, atleti from public.v_numeri_pubblici'),
      )
      expect(rows[0].squadre).toBeGreaterThan(0)
      expect(rows[0].atleti).toBeGreaterThan(0)

      await c.query('savepoint rls_tesseramenti')
      await expect(
        asAnon(c, () => c.query('select id from public.tesseramenti limit 1')),
      ).rejects.toThrow(/permission denied/i)
      await c.query('rollback to savepoint rls_tesseramenti')

      await c.query('savepoint rls_incarichi')
      await expect(
        asAnon(c, () => c.query('select id from public.incarichi_staff limit 1')),
      ).rejects.toThrow(/permission denied/i)
      await c.query('rollback to savepoint rls_incarichi')
    }))

  it('nessuna delle due view pubbliche e security_invoker', () =>
    inRollback(async (c) => {
      /*
       * IL TEST CHE VALE PIÙ DI TUTTI GLI ALTRI DI QUESTO FILE.
       *
       * Le due view servono anon proprio perché NON sono security_invoker:
       * leggono le tabelle coi diritti del proprietario, e le policy — che
       * nominano solo authenticated — non entrano in gioco. Aggiungere
       * `security_invoker = true`, che a chi passa sembra la scelta prudente, le
       * romperebbe in due modi diversi e nessuno dei due è rumoroso: oggi
       * darebbe «permission denied for table stagioni»; e se una migration
       * futura riconcedesse select ad anon, riuscirebbe restituendo zero righe
       * senza errore — cioè 0 squadre e 0 atleti in produzione, in silenzio.
       *
       * Nessun test funzionale lo intercetta prima del deploy: qui si guarda il
       * catalogo, non il comportamento.
       */
      const { rows } = await c.query(`
        select relname, reloptions
        from pg_class
        where relname in ('v_squadre_pubbliche', 'v_numeri_pubblici')
        order by relname
      `)
      expect(rows).toEqual([
        { relname: 'v_numeri_pubblici', reloptions: null },
        { relname: 'v_squadre_pubbliche', reloptions: null },
      ])
    }))
})
