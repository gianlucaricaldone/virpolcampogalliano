import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  annullaPagamento,
  elencaPagamenti,
  impostaImporto,
  importiPerSquadra,
  importoStagione,
  importoTesseramento,
  registraPagamento,
  rimuoviImporto,
  statoQuote,
} from '@/lib/repos/quote'
import {
  clientPerRuolo,
  creaIncarico,
  creaPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
  traccia,
} from './harness-repo'

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

/** Stagione con una squadra e un tesserato: la base di quasi ogni caso. */
async function scenario() {
  const stagioneId = await creaStagione()
  const squadraId = await creaSquadra(stagioneId, { nome: `Quote ${marca()}` })
  const personaId = await creaPersona({ cognome: `Quota${marca()}`, nome: 'Ada' })
  const tesseramentoId = await creaTesseramento({ personaId, stagioneId, squadraId })
  return { stagioneId, squadraId, personaId, tesseramentoId }
}

describe('statoQuote', () => {
  it('legge la vista senza ricalcolare, con persona e squadra', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)
    await registraPagamento(db, { tesseramentoId: s.tesseramentoId, importo: 125, data: '2026-10-01' })

    const righe = await statoQuote(db, s.stagioneId)
    expect(righe).toHaveLength(1)
    expect(righe[0]).toMatchObject({
      tesseramentoId: s.tesseramentoId,
      quotaAttesa: 250,
      pagato: 125,
      residuo: 125,
      stato: 'parziale',
      livelloImporto: 'stagione',
      persona: { id: s.personaId, nome: 'Ada' },
      squadra: { id: s.squadraId },
    })
  })

  it('dice quale livello determina l\'importo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)
    await impostaImporto(db, { squadraId: s.squadraId }, 280)

    const [riga] = await statoQuote(db, s.stagioneId)
    expect(riga).toMatchObject({ quotaAttesa: 280, livelloImporto: 'squadra' })
  })

  it('presenta il sovra-pagamento come credito, non come errore', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)
    await registraPagamento(db, { tesseramentoId: s.tesseramentoId, importo: 300, data: '2026-10-01' })

    const [riga] = await statoQuote(db, s.stagioneId)
    expect(riga).toMatchObject({ stato: 'saldato', residuo: -50 })
  })

  it('filtra per squadra e per chi non ha saldato', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const stagioneId = await creaStagione()
    const squadraA = await creaSquadra(stagioneId, { nome: `A ${marca()}` })
    const squadraB = await creaSquadra(stagioneId, { nome: `B ${marca()}` })
    await impostaImporto(db, { stagioneId }, 100)

    const inA = await creaTesseramento({
      personaId: await creaPersona({ cognome: `InA${marca()}` }), stagioneId, squadraId: squadraA,
    })
    const inB = await creaTesseramento({
      personaId: await creaPersona({ cognome: `InB${marca()}` }), stagioneId, squadraId: squadraB,
    })
    await registraPagamento(db, { tesseramentoId: inB, importo: 100, data: '2026-10-01' })

    expect((await statoQuote(db, stagioneId, { squadraId: squadraA })).map((r) => r.tesseramentoId))
      .toEqual([inA])
    expect((await statoQuote(db, stagioneId, { soloNonSaldate: true })).map((r) => r.tesseramentoId))
      .toEqual([inA])
  })

  it('a un allenatore non mostra nessuna cifra reale', async () => {
    // La vista è security_invoker e l'allenatore non ha policy su
    // quote_importi né su pagamenti_quota: legge zeri, non i numeri veri. È la
    // seconda barriera dopo richiediRuolo nelle pagine.
    const s = await scenario()
    const dirigente = await clientPerRuolo('dirigente')
    await impostaImporto(dirigente.db, { stagioneId: s.stagioneId }, 250)
    await registraPagamento(dirigente.db, {
      tesseramentoId: s.tesseramentoId, importo: 100, data: '2026-10-01',
    })

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({
      personaId: mister.personaId!, stagioneId: s.stagioneId, squadraId: s.squadraId,
    })

    const [riga] = await statoQuote(mister.db, s.stagioneId)
    expect(riga).toMatchObject({ quotaAttesa: 0, pagato: 0, stato: 'saldato' })
  })
})

describe('impostaImporto', () => {
  it('configura i tre livelli e li rilegge', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()

    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)
    await impostaImporto(db, { squadraId: s.squadraId }, 280)
    await impostaImporto(db, { tesseramentoId: s.tesseramentoId }, 125)

    expect(await importoStagione(db, s.stagioneId)).toBe(250)
    expect((await importiPerSquadra(db, [s.squadraId])).get(s.squadraId)).toBe(280)
    expect(await importoTesseramento(db, s.tesseramentoId)).toBe(125)
  })

  it('riscrive l\'importo esistente invece di aggiungere una riga', async () => {
    // Le tre colonne di livello sono UNIQUE: un secondo insert sullo stesso
    // livello violerebbe il vincolo, e l'utente vedrebbe "valore già presente"
    // provando a correggere una cifra.
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)
    await impostaImporto(db, { stagioneId: s.stagioneId }, 300)
    expect(await importoStagione(db, s.stagioneId)).toBe(300)
  })

  it('non trova nulla dove non è configurato', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    expect(await importoStagione(db, s.stagioneId)).toBeNull()
    expect((await importiPerSquadra(db, [s.squadraId])).size).toBe(0)
    expect(await importoTesseramento(db, s.tesseramentoId)).toBeNull()
  })

  it('è negata su stagione chiusa, anche al livello di squadra', async () => {
    // Correzione della review del piano 1: modificare l'importo di una
    // stagione chiusa alterava retroattivamente lo stato di ogni tesserato.
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const squadraId = await creaSquadra(chiusa, { nome: `Chiusa ${marca()}` })

    await expect(impostaImporto(db, { stagioneId: chiusa }, 250)).rejects.toMatchObject({
      code: '42501',
    })
    await expect(impostaImporto(db, { squadraId }, 250)).rejects.toMatchObject({ code: '42501' })
  })

  it('è negata all\'allenatore', async () => {
    const s = await scenario()
    const { db } = await clientPerRuolo('allenatore')
    await expect(impostaImporto(db, { stagioneId: s.stagioneId }, 250)).rejects.toMatchObject({
      code: '42501',
    })
  })
})

describe('rimuoviImporto', () => {
  it('l\'admin toglie un override e si torna al livello superiore', async () => {
    const admin = await clientPerRuolo('admin')
    const s = await scenario()
    await impostaImporto(admin.db, { stagioneId: s.stagioneId }, 250)
    await impostaImporto(admin.db, { squadraId: s.squadraId }, 280)

    const override = await importiPerSquadra(admin.db, [s.squadraId])
    expect(override.get(s.squadraId)).toBe(280)

    await rimuoviImporto(admin.db, { squadraId: s.squadraId })
    const [riga] = await statoQuote(admin.db, s.stagioneId)
    expect(riga).toMatchObject({ quotaAttesa: 250, livelloImporto: 'stagione' })
  })
})

describe('pagamenti', () => {
  it('registra, elenca dal più recente e annulla', async () => {
    const { db, userId } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await impostaImporto(db, { stagioneId: s.stagioneId }, 250)

    const primo = await registraPagamento(db, {
      tesseramentoId: s.tesseramentoId, importo: 125, data: '2026-09-15', registratoDa: userId,
    })
    traccia('pagamenti_quota', primo.id)
    const secondo = await registraPagamento(db, {
      tesseramentoId: s.tesseramentoId, importo: 125, data: '2026-11-20', metodo: 'bonifico',
    })
    traccia('pagamenti_quota', secondo.id)

    const pagamenti = await elencaPagamenti(db, s.tesseramentoId)
    expect(pagamenti.map((p) => p.id)).toEqual([secondo.id, primo.id])
    expect(pagamenti[0].metodo).toBe('bonifico')
    expect((await statoQuote(db, s.stagioneId))[0].stato).toBe('saldato')

    await annullaPagamento(db, secondo.id)
    expect((await statoQuote(db, s.stagioneId))[0]).toMatchObject({
      stato: 'parziale', residuo: 125,
    })
  })

  it('rifiuta un importo non positivo', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const s = await scenario()
    await expect(
      registraPagamento(db, { tesseramentoId: s.tesseramentoId, importo: 0, data: '2026-09-15' }),
    ).rejects.toMatchObject({
      code: '23514',
      message: expect.stringContaining('pagamenti_importo_positivo'),
    })
  })

  it('è negata su stagione chiusa e all\'allenatore', async () => {
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const squadraId = await creaSquadra(chiusa, { nome: `Vecchia ${marca()}` })
    const tesseramentoId = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Vecchio${marca()}` }),
      stagioneId: chiusa,
      squadraId,
    })

    const dirigente = await clientPerRuolo('dirigente')
    await expect(
      registraPagamento(dirigente.db, { tesseramentoId, importo: 50, data: '2026-09-15' }),
    ).rejects.toMatchObject({ code: '42501' })

    const aperta = await scenario()
    const mister = await clientPerRuolo('allenatore')
    await expect(
      registraPagamento(mister.db, {
        tesseramentoId: aperta.tesseramentoId, importo: 50, data: '2026-09-15',
      }),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('all\'allenatore non mostra nessun versamento', async () => {
    const s = await scenario()
    const dirigente = await clientPerRuolo('dirigente')
    const pagamento = await registraPagamento(dirigente.db, {
      tesseramentoId: s.tesseramentoId, importo: 50, data: '2026-09-15',
    })
    traccia('pagamenti_quota', pagamento.id)

    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({
      personaId: mister.personaId!, stagioneId: s.stagioneId, squadraId: s.squadraId,
    })
    expect(await elencaPagamenti(mister.db, s.tesseramentoId)).toEqual([])
  })
})
