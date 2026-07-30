import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  creaIncarico,
  elencaIncarichi,
  rimuoviIncarico,
} from '@/lib/repos/incarichi'
import {
  aggiornaAssegnazione,
  assegnaSquadra,
  chiHaLaMaglia,
  creaTesseramento,
  elencaTesseramenti,
  impostaNumeroMaglia,
  rimuoviTesseramento,
  tesseramentoPerId,
} from '@/lib/repos/tesseramenti'
import {
  clientPerRuolo,
  clientServizio,
  creaIncarico as inserisciIncarico,
  creaPersona,
  creaPresenza,
  creaSeduta,
  creaSquadra,
  creaStagione,
  creaTesseramento as inserisciTesseramento,
  traccia,
} from './harness-repo'

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

describe('elencaTesseramenti', () => {
  it('elenca i tesserati della stagione con la persona, ordinati per cognome', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const altra = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Rosa ${marca()}` })

    const rossi = await creaPersona({ cognome: 'Rossi', nome: 'Aldo' })
    const bianchi = await creaPersona({ cognome: 'Bianchi', nome: 'Ugo' })
    const tessRossi = await inserisciTesseramento({ personaId: rossi, stagioneId: stagione, squadraId: squadra })
    const tessBianchi = await inserisciTesseramento({ personaId: bianchi, stagioneId: stagione })
    const estraneo = await creaPersona({ cognome: 'Altrove' })
    await inserisciTesseramento({ personaId: estraneo, stagioneId: altra })

    const righe = await elencaTesseramenti(db, stagione)
    expect(righe.map((r) => r.id)).toEqual([tessBianchi, tessRossi])
    expect(righe[1]).toMatchObject({
      persona: { id: rossi, cognome: 'Rossi' },
      squadra: { id: squadra },
    })
    expect(righe[0].squadra).toBeNull()
  })

  it('filtra per squadra e sa isolare chi non ne ha una', async () => {
    // `squadra_id` nullo è un caso reale, non un residuo: si tessera a
    // settembre e si smista alle squadre dopo i provini.
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Con ${marca()}` })
    const conSquadra = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Con${marca()}` }),
      stagioneId: stagione,
      squadraId: squadra,
    })
    const senzaSquadra = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Senza${marca()}` }),
      stagioneId: stagione,
    })

    expect((await elencaTesseramenti(db, stagione, { squadraId: squadra })).map((r) => r.id))
      .toEqual([conSquadra])
    expect((await elencaTesseramenti(db, stagione, { senzaSquadra: true })).map((r) => r.id))
      .toEqual([senzaSquadra])
  })

  it('un allenatore vede solo i tesserati delle proprie squadre', async () => {
    const stagione = await creaStagione()
    const mia = await creaSquadra(stagione, { nome: `Mia ${marca()}` })
    const altra = await creaSquadra(stagione, { nome: `Altra ${marca()}` })
    const mioTess = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Mio${marca()}` }),
      stagioneId: stagione,
      squadraId: mia,
    })
    await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Altrui${marca()}` }),
      stagioneId: stagione,
      squadraId: altra,
    })

    const mister = await clientPerRuolo('allenatore')
    await inserisciIncarico({ personaId: mister.personaId!, stagioneId: stagione, squadraId: mia })

    expect((await elencaTesseramenti(mister.db, stagione)).map((r) => r.id)).toEqual([mioTess])

    const dirigente = await clientPerRuolo('dirigente')
    expect((await elencaTesseramenti(dirigente.db, stagione)).length).toBe(2)
  })
})

describe('creaTesseramento', () => {
  it('tessera una persona nella stagione', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Nuova ${marca()}` })
    const personaId = await creaPersona({ cognome: `Tesserato${marca()}` })

    const creato = await creaTesseramento(db, {
      personaId, stagioneId: stagione, squadraId: squadra, numeroMaglia: 10,
    })
    traccia('tesseramenti', creato.id)
    expect(creato).toMatchObject({ numeroMaglia: 10, squadra: { id: squadra } })
  })

  it('rifiuta due tesseramenti della stessa persona nella stessa stagione', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const personaId = await creaPersona({ cognome: `Doppio${marca()}` })
    await inserisciTesseramento({ personaId, stagioneId: stagione })

    await expect(creaTesseramento(db, { personaId, stagioneId: stagione })).rejects.toMatchObject({
      code: '23505',
      message: expect.stringContaining('tesseramenti_persona_id_stagione_id_key'),
    })
  })

  it('rifiuta una squadra di un\'altra stagione', async () => {
    // La FK composita (squadra_id, stagione_id) esiste per questo: nel vecchio
    // schema l'errore era possibile e muto.
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const altra = await creaStagione()
    const squadraAltrove = await creaSquadra(altra, { nome: `Fuori ${marca()}` })
    const personaId = await creaPersona({ cognome: `Sbagliato${marca()}` })

    await expect(
      creaTesseramento(db, { personaId, stagioneId: stagione, squadraId: squadraAltrove }),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('è negata all\'allenatore e su stagione chiusa', async () => {
    const stagione = await creaStagione()
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const personaId = await creaPersona({ cognome: `Vietato${marca()}` })

    const mister = await clientPerRuolo('allenatore')
    await expect(
      creaTesseramento(mister.db, { personaId, stagioneId: stagione }),
    ).rejects.toMatchObject({ code: '42501' })

    const dirigente = await clientPerRuolo('dirigente')
    await expect(
      creaTesseramento(dirigente.db, { personaId, stagioneId: chiusa }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('assegnaSquadra', () => {
  it('sposta il tesserato e sa toglierlo dalla squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const prima = await creaSquadra(stagione, { nome: `Prima ${marca()}` })
    const seconda = await creaSquadra(stagione, { nome: `Seconda ${marca()}` })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Mobile${marca()}` }),
      stagioneId: stagione,
      squadraId: prima,
    })

    await assegnaSquadra(db, id, seconda)
    expect((await tesseramentoPerId(db, id))?.squadra?.id).toBe(seconda)

    await assegnaSquadra(db, id, null)
    expect((await tesseramentoPerId(db, id))?.squadra).toBeNull()
  })

  it('rifiuta lo spostamento se ci sono già presenze con la squadra attuale', async () => {
    // Il vincolo è differito: la violazione arriva al commit, che con
    // PostgREST è la fine della singola richiesta. Le presenze appartengono
    // alla squadra dove sono state raccolte, quindi il messaggio deve dire di
    // cancellarle prima, non "elemento collegato non più esistente".
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const prima = await creaSquadra(stagione, { nome: `Storica ${marca()}` })
    const seconda = await creaSquadra(stagione, { nome: `Nuova ${marca()}` })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Presente${marca()}` }),
      stagioneId: stagione,
      squadraId: prima,
    })
    const seduta = await creaSeduta({ squadraId: prima, stagioneId: stagione })
    await creaPresenza({ sedutaId: seduta, tesseramentoId: id, stato: 'presente' })

    await expect(assegnaSquadra(db, id, seconda)).rejects.toMatchObject({
      code: '23503',
      message: expect.stringContaining('presenze_tesseramento_di_squadra'),
    })
    expect((await tesseramentoPerId(db, id))?.squadra?.id).toBe(prima)
  })

  it('è negata all\'allenatore sulla propria rosa', async () => {
    // Legge la rosa, non la modifica: è la riga che separa i due ruoli.
    const stagione = await creaStagione()
    const mia = await creaSquadra(stagione, { nome: `Mia ${marca()}` })
    const altra = await creaSquadra(stagione, { nome: `Altra ${marca()}` })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Suo${marca()}` }),
      stagioneId: stagione,
      squadraId: mia,
    })
    const mister = await clientPerRuolo('allenatore')
    await inserisciIncarico({ personaId: mister.personaId!, stagioneId: stagione, squadraId: mia })

    await assegnaSquadra(mister.db, id, altra)
    const dirigente = await clientPerRuolo('dirigente')
    expect((await tesseramentoPerId(dirigente.db, id))?.squadra?.id).toBe(mia)
  })
})

describe('impostaNumeroMaglia', () => {
  it('rifiuta due volte lo stesso numero nella stessa squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Maglie ${marca()}` })
    await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Dieci${marca()}` }),
      stagioneId: stagione, squadraId: squadra, numeroMaglia: 10,
    })
    const secondo = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Altro${marca()}` }),
      stagioneId: stagione, squadraId: squadra,
    })

    await expect(impostaNumeroMaglia(db, secondo, 10)).rejects.toMatchObject({
      code: '23505',
      message: expect.stringContaining('tesseramenti_squadra_maglia_uidx'),
    })
  })

  it('ammette lo stesso numero in squadre diverse e più numeri nulli', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const unaSquadra = await creaSquadra(stagione, { nome: `Una ${marca()}` })
    const altraSquadra = await creaSquadra(stagione, { nome: `Altra ${marca()}` })
    const qua = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Qua${marca()}` }),
      stagioneId: stagione, squadraId: unaSquadra,
    })
    const la = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `La${marca()}` }),
      stagioneId: stagione, squadraId: altraSquadra,
    })
    const senzaA = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `SenzaA${marca()}` }),
      stagioneId: stagione, squadraId: unaSquadra,
    })
    const senzaB = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `SenzaB${marca()}` }),
      stagioneId: stagione, squadraId: unaSquadra,
    })

    await impostaNumeroMaglia(db, qua, 7)
    await impostaNumeroMaglia(db, la, 7)
    await impostaNumeroMaglia(db, senzaA, null)
    await impostaNumeroMaglia(db, senzaB, null)
    expect((await tesseramentoPerId(db, la))?.numeroMaglia).toBe(7)
  })

  it('rifiuta un numero fuori intervallo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Range ${marca()}` })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Range${marca()}` }),
      stagioneId: stagione, squadraId: squadra,
    })
    await expect(impostaNumeroMaglia(db, id, 120)).rejects.toMatchObject({
      code: '23514',
      message: expect.stringContaining('tesseramenti_maglia_intervallo'),
    })
  })
})

describe('aggiornaAssegnazione', () => {
  it('sposta e numera in un colpo solo, dove due passi fallirebbero', async () => {
    // Il numero 10 è occupato nella squadra di partenza e libero in quella di
    // arrivo. Scrivendo prima il numero, l'indice unico lo confronterebbe con
    // la squadra vecchia e lo rifiuterebbe; in una sola UPDATE conta solo la
    // riga finale.
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const partenza = await creaSquadra(stagione, { nome: `Partenza ${marca()}` })
    const arrivo = await creaSquadra(stagione, { nome: `Arrivo ${marca()}` })
    await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Occupa${marca()}` }),
      stagioneId: stagione, squadraId: partenza, numeroMaglia: 10,
    })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Trasloca${marca()}` }),
      stagioneId: stagione, squadraId: partenza,
    })

    await aggiornaAssegnazione(db, id, { squadraId: arrivo, numeroMaglia: 10 })
    expect(await tesseramentoPerId(db, id)).toMatchObject({
      squadra: { id: arrivo },
      numeroMaglia: 10,
    })
  })

  it('rifiuta il numero se è occupato nella squadra di arrivo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const partenza = await creaSquadra(stagione, { nome: `Da ${marca()}` })
    const arrivo = await creaSquadra(stagione, { nome: `A ${marca()}` })
    await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Titolare${marca()}` }),
      stagioneId: stagione, squadraId: arrivo, numeroMaglia: 5,
    })
    const id = await inserisciTesseramento({
      personaId: await creaPersona({ cognome: `Aspirante${marca()}` }),
      stagioneId: stagione, squadraId: partenza,
    })

    await expect(
      aggiornaAssegnazione(db, id, { squadraId: arrivo, numeroMaglia: 5 }),
    ).rejects.toMatchObject({ code: '23505' })
    // Niente spostamento a metà: la UPDATE è una sola, quindi o tutto o nulla.
    expect((await tesseramentoPerId(db, id))?.squadra?.id).toBe(partenza)
  })
})

describe('chiHaLaMaglia', () => {
  it('dice chi occupa il numero, così il messaggio può nominarlo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Chi ${marca()}` })
    await inserisciTesseramento({
      personaId: await creaPersona({ cognome: 'Baggio', nome: 'Roberto' }),
      stagioneId: stagione, squadraId: squadra, numeroMaglia: 10,
    })

    expect(await chiHaLaMaglia(db, squadra, 10)).toBe('Baggio Roberto')
    expect(await chiHaLaMaglia(db, squadra, 11)).toBeNull()
  })
})

describe('rimuoviTesseramento', () => {
  it('cancella il tesseramento e lascia la persona in anagrafica', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const servizio = clientServizio()
    const stagione = await creaStagione()
    const personaId = await creaPersona({ cognome: `Ritirato${marca()}` })
    const id = await inserisciTesseramento({ personaId, stagioneId: stagione })

    await rimuoviTesseramento(db, id)
    expect(await tesseramentoPerId(db, id)).toBeNull()
    const { data } = await servizio.from('persone').select('id').eq('id', personaId).maybeSingle()
    expect(data).not.toBeNull()
  })
})

describe('incarichi di staff', () => {
  it('elenca gli incarichi della squadra con la persona', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Staff ${marca()}` })
    const mister = await creaPersona({ cognome: 'Zeman', nome: 'Zdenek' })
    const vice = await creaPersona({ cognome: 'Ancelotti', nome: 'Carlo' })
    await inserisciIncarico({ personaId: mister, stagioneId: stagione, squadraId: squadra })
    await inserisciIncarico({
      personaId: vice, stagioneId: stagione, squadraId: squadra, ruolo: 'vice_allenatore',
    })

    const incarichi = await elencaIncarichi(db, squadra)
    expect(incarichi.map((i) => i.persona.cognome)).toEqual(['Ancelotti', 'Zeman'])
    expect(incarichi[1]).toMatchObject({ ruolo: 'allenatore' })
  })

  it('crea e rimuove un incarico', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Crea ${marca()}` })
    const personaId = await creaPersona({ cognome: `Mister${marca()}` })

    const creato = await creaIncarico(db, {
      personaId, stagioneId: stagione, squadraId: squadra, ruolo: 'dirigente_squadra',
    })
    traccia('incarichi_staff', creato.id)
    expect((await elencaIncarichi(db, squadra)).map((i) => i.id)).toEqual([creato.id])

    await rimuoviIncarico(db, creato.id)
    expect(await elencaIncarichi(db, squadra)).toEqual([])
  })

  it('rifiuta lo stesso ruolo due volte per la stessa persona sulla stessa squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Bis ${marca()}` })
    const personaId = await creaPersona({ cognome: `Bis${marca()}` })
    await inserisciIncarico({ personaId, stagioneId: stagione, squadraId: squadra })

    await expect(
      creaIncarico(db, { personaId, stagioneId: stagione, squadraId: squadra, ruolo: 'allenatore' }),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('è negata all\'allenatore, che pure li legge sulla propria squadra', async () => {
    const stagione = await creaStagione()
    const squadra = await creaSquadra(stagione, { nome: `Sua ${marca()}` })
    const mister = await clientPerRuolo('allenatore')
    await inserisciIncarico({ personaId: mister.personaId!, stagioneId: stagione, squadraId: squadra })

    expect((await elencaIncarichi(mister.db, squadra)).length).toBe(1)
    await expect(
      creaIncarico(mister.db, {
        personaId: await creaPersona({ cognome: `Nuovo${marca()}` }),
        stagioneId: stagione,
        squadraId: squadra,
        ruolo: 'vice_allenatore',
      }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
