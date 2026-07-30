import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  aggiornaSquadra,
  creaSquadra,
  elencaSquadre,
  eliminaSquadra,
  squadraPerId,
} from '@/lib/repos/squadre'
import {
  clientPerRuolo,
  clientServizio,
  creaIncarico,
  creaPersona,
  creaPresenza,
  creaSeduta,
  creaSquadra as inserisciSquadra,
  creaStagione,
  creaTesseramento,
  traccia,
} from './harness-repo'

function marca(): string {
  return randomUUID().slice(0, 8)
}

describe('elencaSquadre', () => {
  it('restituisce solo le squadre della stagione, ordinate per categoria e nome', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const altraStagione = await creaStagione()

    // Nomi tutti diversi: UNIQUE è su (stagione_id, nome), non sulla
    // categoria, quindi due "Alfa" nella stessa stagione non convivono nemmeno
    // in categorie diverse.
    const esordienti = await inserisciSquadra(stagione, { nome: 'Alfa', categoria: 'Esordienti' })
    const pulciniB = await inserisciSquadra(stagione, { nome: 'Delta', categoria: 'Pulcini' })
    const pulciniA = await inserisciSquadra(stagione, { nome: 'Beta', categoria: 'Pulcini' })
    await inserisciSquadra(altraStagione, { nome: 'Estranea', categoria: 'Pulcini' })

    expect((await elencaSquadre(db, stagione)).map((s) => s.id)).toEqual([
      esordienti, pulciniA, pulciniB,
    ])
  })

  it('è visibile anche all\'allenatore, comprese le squadre non sue', async () => {
    // squadre_sel è `using (true)`: i nomi delle squadre servono al sito
    // pubblico. Non è una svista, ed è documentato qui perché il prossimo
    // lettore non provi a "correggerlo" restringendo la policy.
    const stagione = await creaStagione()
    const altrui = await inserisciSquadra(stagione, { nome: `Altrui ${marca()}` })
    const { db } = await clientPerRuolo('allenatore')
    expect((await elencaSquadre(db, stagione)).map((s) => s.id)).toContain(altrui)
  })
})

describe('squadraPerId', () => {
  it('restituisce la squadra con la sua stagione', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const id = await inserisciSquadra(stagione, { nome: `Sola ${marca()}`, annata: 2014 })
    expect(await squadraPerId(db, id)).toMatchObject({ id, stagioneId: stagione, annata: 2014 })
  })

  it('restituisce null per un id inesistente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    expect(await squadraPerId(db, randomUUID())).toBeNull()
  })
})

describe('creaSquadra', () => {
  it('crea una squadra nella stagione indicata', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const creata = await creaSquadra(db, {
      stagioneId: stagione,
      nome: `Nuova ${marca()}`,
      categoria: 'Pulcini',
      annata: 2015,
    })
    traccia('squadre', creata.id)
    expect(creata).toMatchObject({ stagioneId: stagione, categoria: 'Pulcini' })
  })

  it('rifiuta due squadre con lo stesso nome nella stessa stagione', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const nome = `Gemella ${marca()}`
    traccia('squadre', (await creaSquadra(db, { stagioneId: stagione, nome, categoria: 'Pulcini' })).id)

    await expect(
      creaSquadra(db, { stagioneId: stagione, nome, categoria: 'Esordienti' }),
    ).rejects.toMatchObject({
      code: '23505',
      message: expect.stringContaining('squadre_stagione_id_nome_key'),
    })
  })

  it('ammette lo stesso nome in stagioni diverse', async () => {
    // È il caso normale: "Pulcini A" esiste ogni anno. Se il vincolo fosse
    // sul solo nome, la seconda stagione sarebbe impossibile da creare.
    const { db } = await clientPerRuolo('dirigente')
    const nome = `Ricorrente ${marca()}`
    const prima = await creaStagione()
    const seconda = await creaStagione()
    traccia('squadre', (await creaSquadra(db, { stagioneId: prima, nome, categoria: 'Pulcini' })).id)
    traccia('squadre', (await creaSquadra(db, { stagioneId: seconda, nome, categoria: 'Pulcini' })).id)
  })

  it('è negata all\'allenatore', async () => {
    const { db } = await clientPerRuolo('allenatore')
    const stagione = await creaStagione()
    await expect(
      creaSquadra(db, { stagioneId: stagione, nome: `Vietata ${marca()}`, categoria: 'Pulcini' }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('è negata su una stagione chiusa anche al dirigente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    await expect(
      creaSquadra(db, { stagioneId: chiusa, nome: `Tardiva ${marca()}`, categoria: 'Pulcini' }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('aggiornaSquadra', () => {
  it('modifica i campi indicati', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const id = await inserisciSquadra(stagione, { nome: `Vecchia ${marca()}` })
    await aggiornaSquadra(db, id, { categoria: 'Esordienti', annata: 2013 })
    expect(await squadraPerId(db, id)).toMatchObject({ categoria: 'Esordienti', annata: 2013 })
  })

  it('su stagione chiusa non cambia nulla', async () => {
    // Una update negata dalle RLS filtra le righe: riesce e tocca zero righe.
    // Il test guarda il dato, non l'esito della chiamata.
    const dirigente = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const id = await inserisciSquadra(chiusa, { nome: `Congelata ${marca()}`, categoria: 'Pulcini' })
    await aggiornaSquadra(dirigente.db, id, { categoria: 'Esordienti' })
    expect((await squadraPerId(dirigente.db, id))?.categoria).toBe('Pulcini')
  })
})

describe('eliminaSquadra', () => {
  it('porta via sedute e presenze, e lascia il tesserato senza squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const servizio = clientServizio()
    const stagione = await creaStagione()
    const squadra = await inserisciSquadra(stagione, { nome: `Sciolta ${marca()}` })
    const personaId = await creaPersona()
    const tesseramento = await creaTesseramento({ personaId, stagioneId: stagione, squadraId: squadra })
    const seduta = await creaSeduta({ squadraId: squadra, stagioneId: stagione })
    await creaPresenza({ sedutaId: seduta, tesseramentoId: tesseramento, stato: 'presente' })
    const staff = await creaPersona({ cognome: 'Mister' })
    await creaIncarico({ personaId: staff, stagioneId: stagione, squadraId: squadra })

    await eliminaSquadra(db, squadra)

    expect(await squadraPerId(db, squadra)).toBeNull()
    const { count: sedute } = await servizio
      .from('sedute_allenamento').select('id', { count: 'exact', head: true }).eq('id', seduta)
    expect(sedute).toBe(0)
    const { count: incarichi } = await servizio
      .from('incarichi_staff').select('id', { count: 'exact', head: true }).eq('squadra_id', squadra)
    expect(incarichi).toBe(0)

    // Il tesseramento sopravvive senza squadra: il ragazzo resta iscritto
    // alla stagione. È la semantica di `on delete set null (squadra_id)`.
    const { data: rimasto } = await servizio
      .from('tesseramenti').select('id, squadra_id').eq('id', tesseramento).single()
    expect(rimasto).toMatchObject({ id: tesseramento, squadra_id: null })
  })

  it('è negata all\'allenatore', async () => {
    const stagione = await creaStagione()
    const squadra = await inserisciSquadra(stagione, { nome: `Sua ${marca()}` })
    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId: stagione, squadraId: squadra })

    await eliminaSquadra(mister.db, squadra)
    // Come per la update: la delete filtrata dalle RLS riesce e non cancella.
    const dirigente = await clientPerRuolo('dirigente')
    expect(await squadraPerId(dirigente.db, squadra)).not.toBeNull()
  })
})
