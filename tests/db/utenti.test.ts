import { describe, expect, it } from 'vitest'
import { asAnon, asUser, creaPersona, creaUtenteAuth, inRollback } from './harness'

describe('elenco_utenti', () => {
  it('l\'admin vede gli utenti con la loro email', () =>
    inRollback(async (c) => {
      const admin = await creaUtenteAuth(c, { ruolo: 'admin' })
      const persona = await creaPersona(c, { nome: 'Mister', cognome: 'Prova' })
      await creaUtenteAuth(c, { ruolo: 'allenatore', personaId: persona })

      const { rows } = await asUser(c, admin, () =>
        c.query('select * from public.elenco_utenti()'),
      )
      expect(rows.length).toBeGreaterThanOrEqual(2)
      const mister = rows.find((r) => r.persona_id === persona)
      expect(mister).toMatchObject({ ruolo: 'allenatore', attivo: true, persona_nome: 'Mister' })
      expect(mister.email).toMatch(/@test\.local$/)
    }))

  it('nega a un dirigente e a un allenatore', () =>
    inRollback(async (c) => {
      const dirigente = await creaUtenteAuth(c, { ruolo: 'dirigente' })
      await expect(
        asUser(c, dirigente, () => c.query('select * from public.elenco_utenti()')),
      ).rejects.toThrow(/amministratore/i)
    }))

  it('nega ad anon, che non ha nemmeno il privilegio di eseguirla', () =>
    inRollback(async (c) => {
      // Postgres concede EXECUTE a PUBLIC su ogni funzione nuova: senza la
      // revoca esplicita nella migration, la chiave anon — che viaggia nel
      // bundle del browser — potrebbe leggere auth.users attraverso una
      // funzione SECURITY DEFINER. Questo test è ciò che tiene la revoca.
      await expect(
        asAnon(c, () => c.query('select * from public.elenco_utenti()')),
      ).rejects.toThrow(/permission denied/i)
    }))

  it('nega a un utente senza sessione, invece di restituire tutto', () =>
    inRollback(async (c) => {
      // app.mio_ruolo() torna NULL senza auth.uid(). Con `<> 'admin'` il
      // confronto darebbe NULL, l'IF non scatterebbe e la funzione
      // restituirebbe l'elenco intero: il fallimento silenzioso peggiore
      // possibile. Serve `is distinct from`.
      await c.query('set local role authenticated')
      await expect(c.query('select * from public.elenco_utenti()')).rejects.toThrow(
        /amministratore/i,
      )
    }))
})
