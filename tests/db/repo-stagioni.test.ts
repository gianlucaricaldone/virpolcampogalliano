/**
 * Letture del repository stagioni.
 *
 * Isolamento per id tracciati (tests/db/harness-repo.ts), non più
 * `delete().neq('codice','')` in un beforeEach: quel pattern svuotava una
 * tabella condivisa con il seed e con le altre suite, e bastava dimenticare un
 * afterAll perché gli E2E fallissero puntando a un file che non avevano
 * toccato.
 *
 * Conseguenza sulle asserzioni: la tabella non è mai vuota, quindi i casi
 * "nessuna stagione" e "tutte chiuse" non sono esprimibili qui. Non sono
 * scomparsi: sono regole della funzione pura `stagioneCorrenteDa`, e vivono in
 * tests/unit/stagione.test.ts, dove l'insieme in ingresso è controllabile per
 * intero. Qui resta ciò che solo il database può dimostrare — l'ordinamento
 * della query, la ricerca per codice, e il fatto che `stagioneCorrente`
 * componga davvero i due pezzi.
 */
import { describe, expect, it } from 'vitest'
import { elencaStagioni, stagioneCorrente, stagionePerCodice } from '@/lib/repos/stagioni'
import {
  clientPerRuolo,
  codiceStagioneCasuale,
  conPulizia,
  creaStagione,
} from './harness-repo'

// Date oltre qualunque stagione reale o seminata: così la stagione creata dal
// test domina l'insieme e l'asserzione su `stagioneCorrente` non dipende da
// cosa c'è già in tabella.
const LONTANO = '2997-09-01'
const PIU_LONTANO = '2998-09-01'
const LONTANISSIMO = '2999-09-01'

describe('elencaStagioni', () => {
  it('ordina dalla più recente alla più vecchia', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await conPulizia(async () => {
      // Inseriti fuori ordine: se il repository non ordinasse, l'asserzione
      // vedrebbe l'ordine di inserimento e passerebbe per caso.
      const media = await creaStagione({ dataInizio: PIU_LONTANO, dataFine: '2999-06-30' })
      const vecchia = await creaStagione({ dataInizio: LONTANO, dataFine: '2998-06-30' })
      const recente = await creaStagione({ dataInizio: LONTANISSIMO, dataFine: '3000-06-30' })

      const nostre = (await elencaStagioni(db))
        .map((s) => s.id)
        .filter((id) => [media, vecchia, recente].includes(id))
      expect(nostre).toEqual([recente, media, vecchia])
    })
  })
})

describe('stagionePerCodice', () => {
  it('trova la stagione e ne restituisce l\'etichetta', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await conPulizia(async () => {
      const codice = codiceStagioneCasuale()
      await creaStagione({ codice })
      const trovata = await stagionePerCodice(db, codice)
      expect(trovata?.codice).toBe(codice)
    })
  })

  it('restituisce null per un codice inesistente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    expect(await stagionePerCodice(db, '1999-00')).toBeNull()
  })
})

describe('stagioneCorrente', () => {
  it('sceglie la stagione aperta con la data di inizio più avanti', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await conPulizia(async () => {
      await creaStagione({ dataInizio: LONTANO, dataFine: '2998-06-30' })
      const recente = await creaStagione({ dataInizio: LONTANISSIMO, dataFine: '3000-06-30' })
      expect((await stagioneCorrente(db))?.id).toBe(recente)
    })
  })

  it('ignora le stagioni chiuse anche se più recenti', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await conPulizia(async () => {
      const aperta = await creaStagione({ dataInizio: PIU_LONTANO, dataFine: '2999-06-30' })
      await creaStagione({
        dataInizio: LONTANISSIMO,
        dataFine: '3000-06-30',
        stato: 'chiusa',
      })
      expect((await stagioneCorrente(db))?.id).toBe(aperta)
    })
  })
})
