import { describe, expect, it } from 'vitest'
import { aggiornaProfilo, elencaUtenti } from '@/lib/repos/utenti'
import { clientPerRuolo, creaPersona } from './harness-repo'

describe('elencaUtenti', () => {
  it('l\'admin vede gli altri utenti con email e persona', async () => {
    const admin = await clientPerRuolo('admin')
    const mister = await clientPerRuolo('allenatore')

    const utenti = await elencaUtenti(admin.db)
    const riga = utenti.find((u) => u.id === mister.userId)
    expect(riga).toMatchObject({ ruolo: 'allenatore', attivo: true })
    expect(riga?.persona?.id).toBe(mister.personaId)
    expect(riga?.email).toContain('@test.local')
  })

  it('a un dirigente la funzione nega, non restituisce un elenco vuoto', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await expect(elencaUtenti(db)).rejects.toMatchObject({ code: '42501' })
  })
})

describe('aggiornaProfilo', () => {
  it('l\'admin cambia ruolo e collega la persona in una sola scrittura', async () => {
    // Promuovere qualcuno ad allenatore è un gesto solo: in due chiamate la
    // prima passerebbe e la seconda verrebbe respinta da
    // profili_allenatore_ha_persona, lasciando un profilo incoerente.
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    const personaId = await creaPersona({ cognome: 'Promosso' })

    await aggiornaProfilo(admin.db, utente.userId, { ruolo: 'allenatore', personaId })
    const riga = (await elencaUtenti(admin.db)).find((u) => u.id === utente.userId)
    expect(riga).toMatchObject({ ruolo: 'allenatore' })
    expect(riga?.persona?.id).toBe(personaId)
  })

  it('rifiuta di promuovere ad allenatore senza persona', async () => {
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    await expect(
      aggiornaProfilo(admin.db, utente.userId, { ruolo: 'allenatore' }),
    ).rejects.toMatchObject({
      code: '23514',
      message: expect.stringContaining('profili_allenatore_ha_persona'),
    })
  })

  it('disattiva un utente', async () => {
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    await aggiornaProfilo(admin.db, utente.userId, { attivo: false })
    expect((await elencaUtenti(admin.db)).find((u) => u.id === utente.userId)?.attivo).toBe(false)
  })

  it('a un dirigente le policy non fanno cambiare nulla', async () => {
    // profili_upd è riservata all'admin. Una update negata dalle RLS filtra le
    // righe: riesce e tocca zero righe, quindi si guarda il dato.
    const admin = await clientPerRuolo('admin')
    const attaccante = await clientPerRuolo('dirigente')
    const vittima = await clientPerRuolo('allenatore')

    await aggiornaProfilo(attaccante.db, vittima.userId, { ruolo: 'admin' })
    expect((await elencaUtenti(admin.db)).find((u) => u.id === vittima.userId)?.ruolo)
      .toBe('allenatore')
  })
})
