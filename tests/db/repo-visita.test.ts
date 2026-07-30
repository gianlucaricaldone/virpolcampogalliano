import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { beforeAll, describe, expect, it } from 'vitest'
import { impostaVisita, statoVisite, visitaPerTesseramento } from '@/lib/repos/visite'
import {
  clientPerRuolo,
  creaIncarico,
  creaPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
} from './harness-repo'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * La data di oggi la dice il database, non Node.
 *
 * La vista confronta con `current_date`, che segue il fuso del server; il
 * processo di test segue quello della macchina. Vicino a mezzanotte i due
 * differiscono di un giorno, e i test dei confini — che sono il motivo per cui
 * questo file esiste — fallirebbero una volta ogni tanto, di notte, senza che
 * nulla sia cambiato nel codice.
 */
let oggi = ''

beforeAll(async () => {
  const c = new Client({ connectionString: DB_URL })
  await c.connect()
  try {
    const { rows } = await c.query('select current_date::text as oggi')
    oggi = rows[0].oggi
  } finally {
    await c.end()
  }
})

function giorniDopo(giorni: number): string {
  const data = new Date(`${oggi}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + giorni)
  return data.toISOString().slice(0, 10)
}

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

async function tesserato(visitaScadenza: string | null) {
  const stagioneId = await creaStagione()
  const squadraId = await creaSquadra(stagioneId, { nome: `Visite ${marca()}` })
  const personaId = await creaPersona({ cognome: `Visita${marca()}` })
  const id = await creaTesseramento({ personaId, stagioneId, squadraId, visitaScadenza })
  return { id, stagioneId, squadraId, personaId }
}

describe('stato della visita — i quattro casi e i loro confini', () => {
  it('senza data di scadenza è mancante', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(null)
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      stato: 'mancante',
      giorniAllaScadenza: null,
    })
  })

  it('scaduta ieri è scaduta', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(giorniDopo(-1))
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      stato: 'scaduta',
      giorniAllaScadenza: -1,
    })
  })

  it('in scadenza oggi è ancora valida, non scaduta', async () => {
    // Il certificato copre anche il giorno stampato sopra. Con `<=` invece di
    // `<` un ragazzo resterebbe fuori dal campo un giorno prima del dovuto, e
    // nessuno saprebbe perché.
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(oggi)
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      stato: 'in_scadenza',
      giorniAllaScadenza: 0,
    })
  })

  it('a esattamente trenta giorni è già in scadenza', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(giorniDopo(30))
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      stato: 'in_scadenza',
      giorniAllaScadenza: 30,
    })
  })

  it('a trentuno giorni è valida', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(giorniDopo(31))
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      stato: 'valida',
      giorniAllaScadenza: 31,
    })
  })

  it('non guarda la data di consegna', async () => {
    // I dati storici da migrare non ce l'hanno: una regola basata su di essa
    // marcherebbe come mancante ogni record migrato, cioè tutti.
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(giorniDopo(200))
    await impostaVisita(db, t.id, { scadenza: giorniDopo(200), consegnataIl: null })
    expect((await visitaPerTesseramento(db, t.id))?.stato).toBe('valida')
  })
})

describe('statoVisite', () => {
  it('elenca la stagione con persona e squadra, ordinando dalle più urgenti', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Elenco ${marca()}` })

    const valida = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Valida${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(200),
    })
    const scaduta = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Scaduta${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(-10),
    })
    const mancante = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Mancante${marca()}` }),
      stagioneId, squadraId, visitaScadenza: null,
    })

    const righe = await statoVisite(db, stagioneId)
    // Mancante per prima: è il caso in cui non si sa nemmeno se il ragazzo
    // possa scendere in campo. Poi le scadute, poi le valide.
    expect(righe.map((r) => r.tesseramentoId)).toEqual([mancante, scaduta, valida])
    expect(righe[1]).toMatchObject({ squadra: { id: squadraId } })
    expect(righe[0].persona.cognome).toContain('Mancante')
  })

  it('sa restituire solo quelle da sistemare, e filtrare per squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraA = await creaSquadra(stagioneId, { nome: `A ${marca()}` })
    const squadraB = await creaSquadra(stagioneId, { nome: `B ${marca()}` })

    const daSistemare = await creaTesseramento({
      personaId: await creaPersona({ cognome: `DaFare${marca()}` }),
      stagioneId, squadraId: squadraA, visitaScadenza: giorniDopo(5),
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Ok${marca()}` }),
      stagioneId, squadraId: squadraA, visitaScadenza: giorniDopo(300),
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Altrove${marca()}` }),
      stagioneId, squadraId: squadraB, visitaScadenza: null,
    })

    expect((await statoVisite(db, stagioneId, { soloDaSistemare: true, squadraId: squadraA }))
      .map((r) => r.tesseramentoId)).toEqual([daSistemare])
  })

  it('un allenatore vede le visite dei propri tesserati', async () => {
    // È il motivo per cui v_visite non vive dentro v_quote: legata alle
    // policy delle tabelle finanziarie, l'allenatore non vedrebbe nulla.
    const stagioneId = await creaStagione()
    const mia = await creaSquadra(stagioneId, { nome: `Mia ${marca()}` })
    const altra = await creaSquadra(stagioneId, { nome: `Altra ${marca()}` })
    const mio = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Mio${marca()}` }),
      stagioneId, squadraId: mia, visitaScadenza: null,
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Altrui${marca()}` }),
      stagioneId, squadraId: altra, visitaScadenza: null,
    })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId: mia })

    expect((await statoVisite(mister.db, stagioneId)).map((r) => r.tesseramentoId)).toEqual([mio])
  })
})

describe('impostaVisita', () => {
  it('registra scadenza e consegna, e sa cancellarle', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const t = await tesserato(null)

    await impostaVisita(db, t.id, { scadenza: giorniDopo(365), consegnataIl: oggi })
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({
      scadenza: giorniDopo(365),
      consegnataIl: oggi,
      stato: 'valida',
    })

    await impostaVisita(db, t.id, { scadenza: null, consegnataIl: null })
    expect(await visitaPerTesseramento(db, t.id)).toMatchObject({ stato: 'mancante' })
  })

  it('è negata all\'allenatore, anche sui propri', async () => {
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Sua ${marca()}` })
    const id = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Suo${marca()}` }),
      stagioneId, squadraId, visitaScadenza: null,
    })
    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId })

    await impostaVisita(mister.db, id, { scadenza: giorniDopo(100), consegnataIl: null })
    const dirigente = await clientPerRuolo('dirigente')
    expect((await visitaPerTesseramento(dirigente.db, id))?.stato).toBe('mancante')
  })

  it('è negata su stagione chiusa', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const id = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Vecchio${marca()}` }),
      stagioneId: chiusa,
      visitaScadenza: null,
    })
    await impostaVisita(db, id, { scadenza: giorniDopo(100), consegnataIl: null })
    expect((await visitaPerTesseramento(db, id))?.stato).toBe('mancante')
  })
})
