import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  aggiornaPersona,
  archiviaPersona,
  creaPersona,
  elencaPersone,
  personaPerId,
  riattivaPersona,
  storicoPersona,
} from '@/lib/repos/persone'
import {
  clientPerRuolo,
  clientServizio,
  creaIncarico,
  creaPersona as inserisciPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
  traccia,
} from './harness-repo'

/** Marca casuale nel cognome: la tabella è condivisa con il seed e con le altre suite. */
function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

describe('elencaPersone', () => {
  it('ordina per cognome e nome', async () => {
    const m = marca()
    const { db } = await clientPerRuolo('dirigente')
    const bianchi = await inserisciPersona({ cognome: `Bianchi${m}`, nome: 'Anna' })
    const rossiZ = await inserisciPersona({ cognome: `Rossi${m}`, nome: 'Zeno' })
    const rossiA = await inserisciPersona({ cognome: `Rossi${m}`, nome: 'Aldo' })

    const trovate = await elencaPersone(db, { cognome: m })
    expect(trovate.map((p) => p.id)).toEqual([bianchi, rossiA, rossiZ])
  })

  it('filtra per porzione di cognome, senza distinzione di maiuscole', async () => {
    const m = marca()
    const { db } = await clientPerRuolo('dirigente')
    const cercata = await inserisciPersona({ cognome: `Esposito${m}` })
    await inserisciPersona({ cognome: `Altro${marca()}` })

    const trovate = await elencaPersone(db, { cognome: `esposito${m}`.toLowerCase() })
    expect(trovate.map((p) => p.id)).toEqual([cercata])
  })

  it('con soloAttive esclude le archiviate', async () => {
    const m = marca()
    const { db } = await clientPerRuolo('dirigente')
    const attiva = await inserisciPersona({ cognome: `Attiva${m}` })
    const archiviata = await inserisciPersona({ cognome: `Archiviata${m}`, attiva: false })

    expect((await elencaPersone(db, { cognome: m, soloAttive: true })).map((p) => p.id)).toEqual([
      attiva,
    ])
    expect((await elencaPersone(db, { cognome: m })).map((p) => p.id)).toEqual(
      expect.arrayContaining([attiva, archiviata]),
    )
  })

  it('un allenatore vede solo le persone delle proprie squadre', async () => {
    // Il caso che il vecchio harness non sapeva verificare: la stessa
    // funzione, tre client, tre risultati. Se `elencaPersone` accumulasse un
    // filtro applicativo al posto delle RLS, questo test resterebbe verde e
    // quello dell'admin qui sotto no.
    const m = marca()
    const stagioneId = await creaStagione()
    const mia = await creaSquadra(stagioneId, { nome: `Mia ${m}` })
    const altra = await creaSquadra(stagioneId, { nome: `Altra ${m}` })
    const miaGiocatrice = await inserisciPersona({ cognome: `Mia${m}` })
    const altraGiocatrice = await inserisciPersona({ cognome: `Altra${m}` })
    await creaTesseramento({ personaId: miaGiocatrice, stagioneId, squadraId: mia })
    await creaTesseramento({ personaId: altraGiocatrice, stagioneId, squadraId: altra })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId: mia })

    expect((await elencaPersone(mister.db, { cognome: m })).map((p) => p.id)).toEqual([
      miaGiocatrice,
    ])

    for (const ruolo of ['admin', 'dirigente'] as const) {
      const { db } = await clientPerRuolo(ruolo)
      expect((await elencaPersone(db, { cognome: m })).map((p) => p.id)).toEqual(
        expect.arrayContaining([miaGiocatrice, altraGiocatrice]),
      )
    }
  })
})

describe('personaPerId', () => {
  it('restituisce la persona con tutti i recapiti', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const id = await inserisciPersona({ nome: 'Giulia', cognome: `Neri${marca()}` })
    expect(await personaPerId(db, id)).toMatchObject({ id, nome: 'Giulia' })
  })

  it('restituisce null per un id inesistente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    expect(await personaPerId(db, randomUUID())).toBeNull()
  })
})

describe('creaPersona', () => {
  it('crea con il solo obbligatorio e lascia il codice fiscale nullo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const creata = await creaPersona(db, {
      nome: 'Luca',
      cognome: `Gialli${marca()}`,
      dataNascita: '2013-03-02',
    })
    traccia('persone', creata.id)
    expect(creata).toMatchObject({ nome: 'Luca', codiceFiscale: null, attiva: true })
  })

  it('rifiuta un codice fiscale duplicato con il vincolo che sa tradurre', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const cf = `AAABBB00A00A${randomUUID().slice(0, 4).toUpperCase()}`
    const prima = await creaPersona(db, {
      nome: 'Uno',
      cognome: `Uno${marca()}`,
      dataNascita: '2012-01-01',
      codiceFiscale: cf,
    })
    traccia('persone', prima.id)

    await expect(
      creaPersona(db, {
        nome: 'Due',
        cognome: `Due${marca()}`,
        dataNascita: '2012-01-01',
        codiceFiscale: cf,
      }),
    ).rejects.toMatchObject({ code: '23505', message: expect.stringContaining('persone_codice_fiscale_key') })
  })

  it('è negata all\'allenatore dalle policy, non solo dall\'applicazione', async () => {
    const { db } = await clientPerRuolo('allenatore')
    await expect(
      creaPersona(db, { nome: 'Vietata', cognome: `Vietata${marca()}`, dataNascita: '2012-01-01' }),
    ).rejects.toMatchObject({ code: '42501' })
  })
})

describe('aggiornaPersona', () => {
  it('modifica i campi indicati e lascia gli altri', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const id = await inserisciPersona({ nome: 'Marco', cognome: `Blu${marca()}` })
    await aggiornaPersona(db, id, { telefono: '3331234567' })
    expect(await personaPerId(db, id)).toMatchObject({ nome: 'Marco', telefono: '3331234567' })
  })

  it('è negata all\'allenatore', async () => {
    const dirigente = await clientPerRuolo('dirigente')
    const id = await inserisciPersona({ cognome: `Suo${marca()}` })
    const { db } = await clientPerRuolo('allenatore')
    await aggiornaPersona(db, id, { telefono: '3339999999' })
    // Una update negata dalle RLS non è un errore: filtra le righe, quindi
    // aggiorna zero righe e riesce. È il motivo per cui il controllo di ruolo
    // applicativo esiste: qui si verifica solo che il dato non cambi.
    expect((await personaPerId(dirigente.db, id))?.telefono).toBeNull()
  })
})

describe('archiviaPersona', () => {
  it('disattiva senza cancellare', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const id = await inserisciPersona({ cognome: `Storica${marca()}` })
    await archiviaPersona(db, id)

    const dopo = await personaPerId(db, id)
    expect(dopo).not.toBeNull()
    expect(dopo?.attiva).toBe(false)
  })

  it('riattiva chi era stato archiviato per errore', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const id = await inserisciPersona({ cognome: `Tornata${marca()}`, attiva: false })
    await riattivaPersona(db, id)
    expect((await personaPerId(db, id))?.attiva).toBe(true)
  })

  it('una persona con storico non è cancellabile: le FK sono restrict', async () => {
    // Il motivo per cui archiviare non è cancellare. Se un giorno qualcuno
    // sostituisse archiviaPersona con una delete, questo test lo intercetta.
    const stagioneId = await creaStagione()
    const personaId = await inserisciPersona({ cognome: `Vincolata${marca()}` })
    await creaTesseramento({ personaId, stagioneId })

    const { error } = await clientServizio().from('persone').delete().eq('id', personaId)
    expect(error).toMatchObject({ code: '23503' })
  })
})

describe('storicoPersona', () => {
  it('elenca tesseramenti e incarichi dalla stagione più recente', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const vecchia = await creaStagione({ dataInizio: '2997-09-01', dataFine: '2998-06-30' })
    const recente = await creaStagione({ dataInizio: '2999-09-01', dataFine: '3000-06-30' })
    const squadraVecchia = await creaSquadra(vecchia, { nome: `Vecchia ${marca()}` })
    const squadraRecente = await creaSquadra(recente, { nome: `Recente ${marca()}` })
    const personaId = await inserisciPersona({ cognome: `Storia${marca()}` })

    await creaTesseramento({
      personaId, stagioneId: vecchia, squadraId: squadraVecchia, numeroMaglia: 7,
    })
    await creaTesseramento({ personaId, stagioneId: recente, squadraId: squadraRecente })
    await creaIncarico({ personaId, stagioneId: recente, squadraId: squadraRecente })

    const storico = await storicoPersona(db, personaId)
    expect(storico.tesseramenti.map((t) => t.stagione.id)).toEqual([recente, vecchia])
    expect(storico.tesseramenti[1]).toMatchObject({ numeroMaglia: 7 })
    expect(storico.tesseramenti[1].squadra?.nome).toContain('Vecchia')
    expect(storico.incarichi).toHaveLength(1)
    expect(storico.incarichi[0]).toMatchObject({ ruolo: 'allenatore' })
  })

  it('restituisce elenchi vuoti per chi non ha mai giocato', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const personaId = await inserisciPersona({ cognome: `Nuova${marca()}` })
    expect(await storicoPersona(db, personaId)).toEqual({ tesseramenti: [], incarichi: [] })
  })
})
