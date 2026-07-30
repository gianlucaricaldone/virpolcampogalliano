/**
 * Scritture del repository stagioni.
 *
 * Il client non è più service role ma un admin vero (tests/db/harness-repo.ts):
 * le scritture passano quindi anche per stagioni_ins e stagioni_upd, non solo
 * per i vincoli di tabella. Con il service role, una policy sbagliata sarebbe
 * rimasta invisibile a questa suite.
 *
 * Isolamento per id tracciati invece di `delete().neq('codice','')`: vedi il
 * commento in repo-stagioni.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { cambiaStato, creaStagione, stagionePerCodice } from '@/lib/repos/stagioni'
import { clientPerRuolo, codiceStagioneCasuale, conPulizia, traccia } from './harness-repo'

function dati(codice: string) {
  return {
    codice,
    etichetta: etichettaDaCodice(codice),
    dataInizio: '2026-09-01',
    dataFine: '2027-06-30',
  }
}

describe('creaStagione', () => {
  it('crea una stagione aperta', async () => {
    const { db } = await clientPerRuolo('admin')
    await conPulizia(async () => {
      const codice = codiceStagioneCasuale()
      const creata = await creaStagione(db, dati(codice))
      traccia('stagioni', creata.id)
      expect(creata).toMatchObject({ codice, stato: 'aperta' })
    })
  })

  it('propaga l\'errore del vincolo sulla forma del codice', async () => {
    const { db } = await clientPerRuolo('admin')
    await expect(
      creaStagione(db, { ...dati(codiceStagioneCasuale()), codice: '2026/2027' }),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('propaga l\'errore sul codice duplicato', async () => {
    const { db } = await clientPerRuolo('admin')
    await conPulizia(async () => {
      const codice = codiceStagioneCasuale()
      const creata = await creaStagione(db, dati(codice))
      traccia('stagioni', creata.id)
      await expect(creaStagione(db, dati(codice))).rejects.toMatchObject({ code: '23505' })
    })
  })

  it('propaga l\'errore sulle date incoerenti', async () => {
    const { db } = await clientPerRuolo('admin')
    await expect(
      creaStagione(db, {
        ...dati(codiceStagioneCasuale()),
        dataInizio: '2027-09-01',
        dataFine: '2026-06-30',
      }),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('cambiaStato', () => {
  it('chiude e riapre una stagione', async () => {
    const { db } = await clientPerRuolo('admin')
    await conPulizia(async () => {
      const codice = codiceStagioneCasuale()
      const creata = await creaStagione(db, dati(codice))
      traccia('stagioni', creata.id)

      // Rilettura per codice, non `elencaStagioni()[0]`: quell'indice
      // dipendeva dal fatto che la tabella contenesse una sola riga, cosa che
      // era vera solo grazie al beforeEach che svuotava tutto.
      await cambiaStato(db, creata.id, 'chiusa')
      expect((await stagionePerCodice(db, codice))?.stato).toBe('chiusa')
      await cambiaStato(db, creata.id, 'aperta')
      expect((await stagionePerCodice(db, codice))?.stato).toBe('aperta')
    })
  })
})
