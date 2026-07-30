/**
 * L'harness è infrastruttura: se si rompe in silenzio, ogni suite che lo usa
 * diventa un falso verde. Questi test sono la sua rete.
 *
 * Il caso che conta davvero è "la stessa funzione dà esiti diversi per ruoli
 * diversi": è la proprietà per cui l'harness esiste. Se l'autenticazione
 * smettesse di funzionare, i client sarebbero anonimi o service-role, e in
 * entrambi i casi quel test fallisce — mentre un test di solo diniego
 * passerebbe comunque.
 */
import { describe, expect, it } from 'vitest'
import { getSessione } from '@/lib/auth/session'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { creaStagione as creaStagioneRepo, elencaStagioni } from '@/lib/repos/stagioni'
import {
  clientPerRuolo,
  clientServizio,
  codiceStagioneCasuale,
  conPulizia,
  creaIncarico,
  creaPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
  pulisci,
  traccia,
} from './harness-repo'

async function personaEsiste(id: string): Promise<boolean> {
  const { data, error } = await clientServizio()
    .from('persone').select('id').eq('id', id).maybeSingle()
  if (error) throw error
  return data !== null
}

describe('clientPerRuolo', () => {
  it('autentica davvero come l\'utente creato', async () => {
    const { db, userId } = await clientPerRuolo('dirigente')
    expect(await getSessione(db)).toMatchObject({ userId, ruolo: 'dirigente' })
  })

  it('collega una persona all\'allenatore', async () => {
    // profili_allenatore_ha_persona lo impone, e senza persona le RLS
    // dell'allenatore non risolvono nessuna squadra.
    const { db, personaId } = await clientPerRuolo('allenatore')
    expect(personaId).not.toBeNull()
    expect((await getSessione(db))?.personaId).toBe(personaId)
  })

  it('produce un token del ruolo authenticated, non service_role', async () => {
    // Guardia contro il modo di rompersi che nessun altro test intercetta: un
    // client service-role passerebbe tutti i test di permesso e fallirebbe
    // solo quelli di diniego, e un client anonimo il contrario. Qui si guarda
    // direttamente il claim su cui le policy si fondano.
    const { db } = await clientPerRuolo('allenatore')
    const { data } = await db.auth.getSession()
    const claims = JSON.parse(
      Buffer.from(data.session!.access_token.split('.')[1], 'base64url').toString(),
    )
    expect(claims.role).toBe('authenticated')
  })

  it('accetta una persona già esistente', async () => {
    const personaId = await creaPersona({ nome: 'Luigi', cognome: 'Verdi' })
    const sessione = await clientPerRuolo('allenatore', { personaId })
    expect(sessione.personaId).toBe(personaId)
  })
})

describe('i client rispettano le RLS', () => {
  it('la stessa funzione di repository dà esiti diversi per ruoli diversi', async () => {
    const admin = await clientPerRuolo('admin')
    const dirigente = await clientPerRuolo('dirigente')

    const codice = codiceStagioneCasuale()
    const creata = await creaStagioneRepo(admin.db, {
      codice,
      etichetta: etichettaDaCodice(codice),
      dataInizio: '2026-09-01',
      dataFine: '2027-06-30',
    })
    traccia('stagioni', creata.id)
    expect(creata.codice).toBe(codice)

    // stagioni_ins è riservata all'admin: la stessa chiamata, con un client
    // diverso, deve essere rifiutata dalla policy con un 42501.
    const altro = codiceStagioneCasuale()
    await expect(
      creaStagioneRepo(dirigente.db, {
        codice: altro,
        etichetta: etichettaDaCodice(altro),
        dataInizio: '2026-09-01',
        dataFine: '2027-06-30',
      }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('un allenatore legge solo le persone delle proprie squadre', async () => {
    const stagioneId = await creaStagione()
    const miaSquadra = await creaSquadra(stagioneId, { nome: 'Pulcini A' })
    const altraSquadra = await creaSquadra(stagioneId, { nome: 'Pulcini B' })
    const mioGiocatore = await creaPersona({ cognome: 'Mio' })
    const altroGiocatore = await creaPersona({ cognome: 'Altro' })
    await creaTesseramento({ personaId: mioGiocatore, stagioneId, squadraId: miaSquadra })
    await creaTesseramento({ personaId: altroGiocatore, stagioneId, squadraId: altraSquadra })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId: miaSquadra })

    const { data: viste, error } = await mister.db.from('persone').select('id')
    if (error) throw error
    const idVisti = viste.map((r) => r.id)
    expect(idVisti).toContain(mioGiocatore)
    expect(idVisti).not.toContain(altroGiocatore)

    const dirigente = await clientPerRuolo('dirigente')
    const { data: tutte, error: erroreDirigente } = await dirigente.db.from('persone').select('id')
    if (erroreDirigente) throw erroreDirigente
    expect(tutte.map((r) => r.id)).toEqual(
      expect.arrayContaining([mioGiocatore, altroGiocatore]),
    )
  })

  it('tutti i ruoli leggono le stagioni', async () => {
    // Contrappeso ai dinieghi qui sopra: se l'impersonificazione fosse rotta e
    // ogni chiamata fallisse, questo test sarebbe l'unico ad accorgersene.
    const stagioneId = await creaStagione()
    for (const ruolo of ['admin', 'dirigente', 'allenatore'] as const) {
      const { db } = await clientPerRuolo(ruolo)
      expect((await elencaStagioni(db)).map((s) => s.id)).toContain(stagioneId)
    }
  })
})

describe('pulizia', () => {
  it('rimuove ciò che è tracciato e nulla di più', async () => {
    const servizio = clientServizio()
    const { data: estranea, error } = await servizio
      .from('persone')
      .insert({ nome: 'Estranea', cognome: 'NonTracciata', data_nascita: '2010-01-01' })
      .select('id')
      .single()
    if (error) throw error

    let tracciata = ''
    await conPulizia(async () => {
      tracciata = await creaPersona({ cognome: 'Tracciata' })
    })

    expect(await personaEsiste(tracciata)).toBe(false)
    expect(await personaEsiste(estranea.id)).toBe(true)

    await servizio.from('persone').delete().eq('id', estranea.id)
  })

  it('gira anche se il corpo lancia', async () => {
    let personaId = ''
    await expect(
      conPulizia(async () => {
        personaId = await creaPersona({ cognome: 'Esplosa' })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await personaEsiste(personaId)).toBe(false)
  })

  it('cancella nell\'ordine giusto anche con dipendenze complete', async () => {
    let personaId = ''
    let stagioneId = ''
    await conPulizia(async () => {
      stagioneId = await creaStagione()
      const squadraId = await creaSquadra(stagioneId)
      personaId = await creaPersona()
      await creaTesseramento({ personaId, stagioneId, squadraId })
      await creaIncarico({ personaId, stagioneId, squadraId })
    })

    const servizio = clientServizio()
    expect(await personaEsiste(personaId)).toBe(false)
    const { data } = await servizio.from('stagioni').select('id').eq('id', stagioneId).maybeSingle()
    expect(data).toBeNull()
  })

  it('è idempotente', async () => {
    await pulisci()
    await expect(pulisci()).resolves.toBeUndefined()
  })
})
