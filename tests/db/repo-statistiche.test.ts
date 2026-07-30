import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { statistichePerGiocatore, statistichePerSquadra } from '@/lib/repos/statistiche'
import {
  clientPerRuolo,
  creaIncarico,
  creaPersona,
  creaPresenza,
  creaSeduta,
  creaSquadra,
  creaStagione,
  creaTesseramento,
} from './harness-repo'

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

describe('statistichePerGiocatore', () => {
  it('conta le presenze sul totale delle sedute della squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Stat ${marca()}` })
    const tesseramentoId = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Assiduo${marca()}` }), stagioneId, squadraId,
    })
    const prima = await creaSeduta({ squadraId, stagioneId, data: '2026-10-01' })
    const seconda = await creaSeduta({ squadraId, stagioneId, data: '2026-10-08' })
    await creaPresenza({ sedutaId: prima, tesseramentoId, stato: 'presente' })
    await creaPresenza({ sedutaId: seconda, tesseramentoId, stato: 'assente' })

    const [riga] = await statistichePerGiocatore(db, stagioneId)
    expect(riga).toMatchObject({
      seduteSquadra: 2,
      presenti: 1,
      assenti: 1,
      nonRegistrate: 0,
      percentuale: 50,
    })
  })

  it('chi arriva a stagione iniziata ha percentuale bassa e non registrate alte', async () => {
    // È la lettura onesta: il denominatore non si aggiusta per farla sembrare
    // migliore. `nonRegistrate` è ciò che rende leggibile il perché.
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Tardivo ${marca()}` })
    const tesseramentoId = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Gennaio${marca()}` }), stagioneId, squadraId,
    })
    for (const data of ['2026-10-01', '2026-10-08', '2026-10-15']) {
      await creaSeduta({ squadraId, stagioneId, data })
    }
    const ultima = await creaSeduta({ squadraId, stagioneId, data: '2026-10-22' })
    await creaPresenza({ sedutaId: ultima, tesseramentoId, stato: 'presente' })

    const [riga] = await statistichePerGiocatore(db, stagioneId)
    expect(riga).toMatchObject({ seduteSquadra: 4, presenti: 1, nonRegistrate: 3, percentuale: 25 })
  })

  it('senza sedute la percentuale è nulla, non zero', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Ferma ${marca()}` })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Fermo${marca()}` }), stagioneId, squadraId,
    })

    const [riga] = await statistichePerGiocatore(db, stagioneId)
    expect(riga.percentuale).toBeNull()
    expect(riga.seduteSquadra).toBe(0)
  })

  it('ordina dalla percentuale più alta e mette in fondo chi non ne ha', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const conSedute = await creaSquadra(stagioneId, { nome: `Attiva ${marca()}` })
    const senzaSedute = await creaSquadra(stagioneId, { nome: `Inattiva ${marca()}` })

    const assiduo = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Assiduo${marca()}` }),
      stagioneId, squadraId: conSedute,
    })
    const saltuario = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Saltuario${marca()}` }),
      stagioneId, squadraId: conSedute,
    })
    const senzaDati = await creaTesteramentoSenzaSedute(stagioneId, senzaSedute)

    const prima = await creaSeduta({ squadraId: conSedute, stagioneId, data: '2026-10-01' })
    const seconda = await creaSeduta({ squadraId: conSedute, stagioneId, data: '2026-10-08' })
    await creaPresenza({ sedutaId: prima, tesseramentoId: assiduo, stato: 'presente' })
    await creaPresenza({ sedutaId: seconda, tesseramentoId: assiduo, stato: 'presente' })
    await creaPresenza({ sedutaId: prima, tesseramentoId: saltuario, stato: 'presente' })

    const righe = await statistichePerGiocatore(db, stagioneId)
    expect(righe.map((r) => r.tesseramentoId)).toEqual([assiduo, saltuario, senzaDati])
  })

  it('filtra per squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraA = await creaSquadra(stagioneId, { nome: `A ${marca()}` })
    const squadraB = await creaSquadra(stagioneId, { nome: `B ${marca()}` })
    const inA = await creaTesseramento({
      personaId: await creaPersona({ cognome: `InA${marca()}` }), stagioneId, squadraId: squadraA,
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `InB${marca()}` }), stagioneId, squadraId: squadraB,
    })

    expect((await statistichePerGiocatore(db, stagioneId, { squadraId: squadraA }))
      .map((r) => r.tesseramentoId)).toEqual([inA])
  })

  it('un allenatore vede solo i propri giocatori', async () => {
    const stagioneId = await creaStagione()
    const mia = await creaSquadra(stagioneId, { nome: `Mia ${marca()}` })
    const altra = await creaSquadra(stagioneId, { nome: `Altra ${marca()}` })
    const mio = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Mio${marca()}` }), stagioneId, squadraId: mia,
    })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Altrui${marca()}` }), stagioneId, squadraId: altra,
    })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId: mia })

    expect((await statistichePerGiocatore(mister.db, stagioneId)).map((r) => r.tesseramentoId))
      .toEqual([mio])
  })
})

describe('statistichePerSquadra', () => {
  it('la media di squadra ha per denominatore sedute per tesserati', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const nome = `Media ${marca()}`
    const squadraId = await creaSquadra(stagioneId, { nome })
    const primo = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Primo${marca()}` }), stagioneId, squadraId,
    })
    const secondo = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Secondo${marca()}` }), stagioneId, squadraId,
    })
    const prima = await creaSeduta({ squadraId, stagioneId, data: '2026-10-01' })
    const seconda = await creaSeduta({ squadraId, stagioneId, data: '2026-10-08' })
    await creaPresenza({ sedutaId: prima, tesseramentoId: primo, stato: 'presente' })
    await creaPresenza({ sedutaId: seconda, tesseramentoId: primo, stato: 'presente' })
    await creaPresenza({ sedutaId: prima, tesseramentoId: secondo, stato: 'presente' })
    await creaPresenza({ sedutaId: seconda, tesseramentoId: secondo, stato: 'assente' })

    const righe = await statistichePerSquadra(db, stagioneId)
    const riga = righe.find((r) => r.squadraId === squadraId)
    // 3 presenze su 2 sedute × 2 tesserati = 75%. Il conteggio dei tesserati
    // non deve essere gonfiato dal join con le presenze.
    expect(riga).toMatchObject({ nome, tesserati: 2, sedute: 2, presenti: 3, percentuale: 75 })
  })

  it('una squadra senza sedute ha percentuale nulla', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Vuota ${marca()}` })
    await creaTesseramento({
      personaId: await creaPersona({ cognome: `Vuoto${marca()}` }), stagioneId, squadraId,
    })

    const riga = (await statistichePerSquadra(db, stagioneId))
      .find((r) => r.squadraId === squadraId)
    expect(riga?.percentuale).toBeNull()
  })
})

/** Tesseramento in una squadra che non ha sedute: percentuale nulla garantita. */
async function creaTesteramentoSenzaSedute(stagioneId: string, squadraId: string) {
  return creaTesseramento({
    personaId: await creaPersona({ cognome: `Zsenza${marca()}` }),
    stagioneId,
    squadraId,
  })
}
