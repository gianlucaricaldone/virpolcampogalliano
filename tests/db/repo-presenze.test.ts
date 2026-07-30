import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  creaSeduta,
  elencaSedute,
  getFoglio,
  rimuoviSeduta,
  salvaPresenze,
  sedutaPerId,
} from '@/lib/repos/presenze'
import {
  clientPerRuolo,
  clientServizio,
  creaIncarico,
  creaPersona,
  creaPresenza,
  creaSeduta as inserisciSeduta,
  creaSquadra,
  creaStagione,
  creaTesseramento,
  traccia,
} from './harness-repo'

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

/** Stagione, squadra, allenatore incaricato e due tesserati. */
async function scenario() {
  const stagioneId = await creaStagione()
  const squadraId = await creaSquadra(stagioneId, { nome: `Presenze ${marca()}` })
  const primo = await creaTesseramento({
    personaId: await creaPersona({ cognome: `Alfa${marca()}` }), stagioneId, squadraId,
  })
  const secondo = await creaTesseramento({
    personaId: await creaPersona({ cognome: `Beta${marca()}` }), stagioneId, squadraId,
  })
  const mister = await clientPerRuolo('allenatore')
  await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId })
  return { stagioneId, squadraId, primo, secondo, mister }
}

describe('sedute', () => {
  it('elenca solo quelle della squadra, dalla più recente, con quante ne sono compilate', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const altraSquadra = await creaSquadra(s.stagioneId, { nome: `Altra ${marca()}` })

    const vecchia = await inserisciSeduta({
      squadraId: s.squadraId, stagioneId: s.stagioneId, data: '2026-10-01',
    })
    const recente = await inserisciSeduta({
      squadraId: s.squadraId, stagioneId: s.stagioneId, data: '2026-10-08',
    })
    await inserisciSeduta({
      squadraId: altraSquadra, stagioneId: s.stagioneId, data: '2026-10-08',
    })
    await creaPresenza({ sedutaId: vecchia, tesseramentoId: s.primo, stato: 'presente' })

    const sedute = await elencaSedute(db, s.squadraId)
    expect(sedute.map((x) => x.id)).toEqual([recente, vecchia])
    expect(sedute[1].registrate).toBe(1)
    expect(sedute[0].registrate).toBe(0)
  })

  it('l\'allenatore crea una seduta sulla propria squadra', async () => {
    // È il solo caso in cui scrive: la sua squadra, le sue sedute.
    const s = await scenario()
    const creata = await creaSeduta(s.mister.db, {
      squadraId: s.squadraId, stagioneId: s.stagioneId, data: '2026-11-03', oraInizio: '18:30',
    })
    traccia('sedute_allenamento', creata.id)
    expect(creata).toMatchObject({ data: '2026-11-03', oraInizio: '18:30:00' })
  })

  it('l\'allenatore non crea sedute su una squadra che non è sua', async () => {
    const s = await scenario()
    const altrui = await creaSquadra(s.stagioneId, { nome: `Altrui ${marca()}` })
    await expect(
      creaSeduta(s.mister.db, {
        squadraId: altrui, stagioneId: s.stagioneId, data: '2026-11-03',
      }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('rifiuta due sedute nello stesso giorno e alla stessa ora', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    traccia('sedute_allenamento', (await creaSeduta(db, {
      squadraId: s.squadraId, stagioneId: s.stagioneId, data: '2026-11-03',
    })).id)

    // NULLS NOT DISTINCT: due sedute senza ora nello stesso giorno collidono.
    await expect(
      creaSeduta(db, { squadraId: s.squadraId, stagioneId: s.stagioneId, data: '2026-11-03' }),
    ).rejects.toMatchObject({
      code: '23505',
      message: expect.stringContaining('sedute_squadra_data_ora_key'),
    })
  })

  it('è negata su stagione chiusa', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const squadraId = await creaSquadra(chiusa, { nome: `Vecchia ${marca()}` })
    await expect(
      creaSeduta(db, { squadraId, stagioneId: chiusa, data: '2026-11-03' }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('cancellare una seduta porta via le sue presenze', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    await creaPresenza({ sedutaId, tesseramentoId: s.primo, stato: 'presente' })

    await rimuoviSeduta(db, sedutaId)
    expect(await sedutaPerId(db, sedutaId)).toBeNull()
    const { count } = await clientServizio()
      .from('presenze').select('id', { count: 'exact', head: true }).eq('seduta_id', sedutaId)
    expect(count).toBe(0)
  })
})

describe('getFoglio', () => {
  it('porta seduta, rosa intera e presenze già registrate', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    await creaPresenza({ sedutaId, tesseramentoId: s.primo, stato: 'presente' })

    const foglio = await getFoglio(db, sedutaId)
    expect(foglio?.seduta.id).toBe(sedutaId)
    expect(foglio?.righe.map((r) => r.tesseramentoId).sort()).toEqual([s.primo, s.secondo].sort())
    // Chi non ha una riga di presenza compare comunque, con stato nullo: è la
    // differenza fra "assente" e "non compilato".
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.primo)?.stato).toBe('presente')
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.secondo)?.stato).toBeNull()
  })

  it('restituisce null per una seduta inesistente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    expect(await getFoglio(db, randomUUID())).toBeNull()
  })

  it('l\'allenatore lo legge sulla propria squadra', async () => {
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    const foglio = await getFoglio(s.mister.db, sedutaId)
    expect(foglio?.righe).toHaveLength(2)
  })
})

describe('salvaPresenze', () => {
  it('scrive tutte le righe in una volta e le riscrive senza duplicare', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })

    await salvaPresenze(db, sedutaId, [
      { tesseramentoId: s.primo, stato: 'presente' },
      { tesseramentoId: s.secondo, stato: 'assente' },
    ])
    let foglio = await getFoglio(db, sedutaId)
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.secondo)?.stato).toBe('assente')

    // Seconda scrittura sulle stesse righe: UNIQUE (seduta_id, tesseramento_id)
    // rifiuterebbe un insert, quindi deve essere un upsert.
    await salvaPresenze(db, sedutaId, [{ tesseramentoId: s.secondo, stato: 'giustificato' }])
    foglio = await getFoglio(db, sedutaId)
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.secondo)?.stato).toBe('giustificato')
    const { count } = await clientServizio()
      .from('presenze').select('id', { count: 'exact', head: true }).eq('seduta_id', sedutaId)
    expect(count).toBe(2)
  })

  it('uno stato nullo cancella la riga invece di inventarne uno', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    await salvaPresenze(db, sedutaId, [{ tesseramentoId: s.primo, stato: 'presente' }])

    await salvaPresenze(db, sedutaId, [{ tesseramentoId: s.primo, stato: null }])
    const foglio = await getFoglio(db, sedutaId)
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.primo)?.stato).toBeNull()
  })

  it('non chiede la squadra al chiamante: la ricava dalla seduta', async () => {
    // La colonna è denormalizzata e NOT NULL; farla passare dal chiamante è il
    // modo di scriverci dentro la squadra sbagliata.
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    await salvaPresenze(db, sedutaId, [{ tesseramentoId: s.primo, stato: 'presente' }])

    const { data } = await clientServizio()
      .from('presenze').select('squadra_id').eq('seduta_id', sedutaId).single()
    expect(data?.squadra_id).toBe(s.squadraId)
  })

  it('l\'allenatore compila il foglio della propria squadra', async () => {
    const s = await scenario()
    const sedutaId = await inserisciSeduta({ squadraId: s.squadraId, stagioneId: s.stagioneId })
    await salvaPresenze(s.mister.db, sedutaId, [{ tesseramentoId: s.primo, stato: 'presente' }])
    const foglio = await getFoglio(s.mister.db, sedutaId)
    expect(foglio?.righe.find((r) => r.tesseramentoId === s.primo)?.stato).toBe('presente')
  })

  it('l\'allenatore non scrive presenze sulla seduta di un\'altra squadra', async () => {
    // Insert diretta e non salvaPresenze: quel percorso ricava la squadra
    // dalla seduta, che l'allenatore non vede — otterrebbe "seduta
    // inesistente", cioè l'errore sbagliato, e il test sarebbe verde per il
    // motivo sbagliato. Vedi docs/TRAPPOLE.md.
    const s = await scenario()
    const altraSquadra = await creaSquadra(s.stagioneId, { nome: `Estranea ${marca()}` })
    const altroTesseramento = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Estraneo${marca()}` }),
      stagioneId: s.stagioneId,
      squadraId: altraSquadra,
    })
    const sedutaAltrui = await inserisciSeduta({
      squadraId: altraSquadra, stagioneId: s.stagioneId,
    })

    const { error } = await s.mister.db.from('presenze').insert({
      seduta_id: sedutaAltrui,
      tesseramento_id: altroTesseramento,
      squadra_id: altraSquadra,
      stato: 'presente',
    })
    expect(error).toMatchObject({ code: '42501' })
  })

  it('è negata su stagione chiusa', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const squadraId = await creaSquadra(chiusa, { nome: `Chiusa ${marca()}` })
    const tesseramentoId = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Chiuso${marca()}` }),
      stagioneId: chiusa,
      squadraId,
    })
    const sedutaId = await inserisciSeduta({ squadraId, stagioneId: chiusa })

    await expect(
      salvaPresenze(db, sedutaId, [{ tesseramentoId, stato: 'presente' }]),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
