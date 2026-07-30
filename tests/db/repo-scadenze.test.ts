import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { beforeAll, describe, expect, it } from 'vitest'
import { impostaImporto, registraPagamento } from '@/lib/repos/quote'
import { scadenzeStagione } from '@/lib/repos/scadenze'
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

// La data di oggi la dice il database: v_visite confronta con current_date,
// che segue il fuso del server e non quello del processo di test.
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

describe('scadenzeStagione', () => {
  it('elenca solo le quote aperte e solo le visite da sistemare', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Scadenze ${marca()}` })
    await impostaImporto(db, { stagioneId }, 100)

    const moroso = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Moroso${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(300),
    })
    const inRegola = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Regola${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(300),
    })
    const senzaVisita = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Visita${marca()}` }),
      stagioneId, squadraId, visitaScadenza: null,
    })
    await registraPagamento(db, { tesseramentoId: inRegola, importo: 100, data: oggi })
    await registraPagamento(db, { tesseramentoId: senzaVisita, importo: 100, data: oggi })

    const scadenze = await scadenzeStagione(db, stagioneId, { includiQuote: true })
    expect(scadenze.quote?.map((r) => r.tesseramentoId)).toEqual([moroso])
    expect(scadenze.visite.map((r) => r.tesseramentoId)).toEqual([senzaVisita])
  })

  it('il filtro per squadra vale per entrambi gli elenchi', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraA = await creaSquadra(stagioneId, { nome: `A ${marca()}` })
    const squadraB = await creaSquadra(stagioneId, { nome: `B ${marca()}` })
    await impostaImporto(db, { stagioneId }, 100)

    const inA = await creaTesseramento({
      personaId: await creaPersona({ cognome: `InA${marca()}` }),
      stagioneId, squadraId: squadraA, visitaScadenza: giorniDopo(-1),
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `InB${marca()}` }),
      stagioneId, squadraId: squadraB, visitaScadenza: null,
    })

    const scadenze = await scadenzeStagione(db, stagioneId, {
      squadraId: squadraA,
      includiQuote: true,
    })
    expect(scadenze.quote?.map((r) => r.tesseramentoId)).toEqual([inA])
    expect(scadenze.visite.map((r) => r.tesseramentoId)).toEqual([inA])
  })

  it('senza includiQuote le quote non arrivano affatto', async () => {
    // Non un elenco vuoto: nullo. Un elenco vuoto e uno non richiesto sono
    // due cose diverse, e la pagina deve poterle distinguere per non mostrare
    // "nessuna quota aperta" a chi non può vederle.
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Niente ${marca()}` })
    await impostaImporto(db, { stagioneId }, 100)
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Aperta${marca()}` }),
      stagioneId, squadraId, visitaScadenza: null,
    })

    const scadenze = await scadenzeStagione(db, stagioneId, { includiQuote: false })
    expect(scadenze.quote).toBeNull()
    expect(scadenze.visite).toHaveLength(1)
  })

  it('un allenatore vede le visite dei propri e nient\'altro', async () => {
    const stagioneId = await creaStagione()
    const mia = await creaSquadra(stagioneId, { nome: `Mia ${marca()}` })
    const altra = await creaSquadra(stagioneId, { nome: `Altra ${marca()}` })
    const mio = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Mio${marca()}` }),
      stagioneId, squadraId: mia, visitaScadenza: giorniDopo(-5),
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Altrui${marca()}` }),
      stagioneId, squadraId: altra, visitaScadenza: null,
    })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId: mia })

    const scadenze = await scadenzeStagione(mister.db, stagioneId, { includiQuote: false })
    expect(scadenze.quote).toBeNull()
    expect(scadenze.visite.map((r) => r.tesseramentoId)).toEqual([mio])
  })

  it('ordina le visite dalla più urgente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Ordine ${marca()}` })

    const inScadenza = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Presto${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(10),
    })
    const scaduta = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Scaduta${marca()}` }),
      stagioneId, squadraId, visitaScadenza: giorniDopo(-2),
    })
    const mancante = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Mai${marca()}` }),
      stagioneId, squadraId, visitaScadenza: null,
    })

    const scadenze = await scadenzeStagione(db, stagioneId, { includiQuote: false })
    expect(scadenze.visite.map((r) => r.tesseramentoId)).toEqual([mancante, scaduta, inScadenza])
  })
})
