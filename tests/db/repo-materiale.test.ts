import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TAGLIE } from '@/lib/domain/materiale'
import {
  elencaTesseramenti,
  impostaMateriale,
  tesseramentoPerId,
} from '@/lib/repos/tesseramenti'
import {
  clientPerRuolo,
  creaIncarico,
  creaPersona,
  creaSquadra,
  creaStagione,
  creaTesseramento,
} from './harness-repo'

function marca(): string {
  return `Z${randomUUID().slice(0, 8)}`
}

async function tesserato() {
  const stagioneId = await creaStagione()
  const squadraId = await creaSquadra(stagioneId, { nome: `Materiale ${marca()}` })
  const personaId = await creaPersona({ cognome: `Materiale${marca()}` })
  const id = await creaTesseramento({ personaId, stagioneId, squadraId, visitaScadenza: null })
  return { id, stagioneId, squadraId, personaId }
}

describe('materiale sportivo', () => {
  it('un tesseramento nuovo non ha materiale né taglia', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    expect(await tesseramentoPerId(db, id)).toMatchObject({
      materialeConsegnato: false,
      materialeTaglia: null,
    })
  })

  it('registra consegna e taglia insieme', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    await impostaMateriale(db, id, { consegnato: true, taglia: 'M' })
    expect(await tesseramentoPerId(db, id)).toMatchObject({
      materialeConsegnato: true,
      materialeTaglia: 'M',
    })
  })

  /*
   * Le due combinazioni asimmetriche, ed è qui che il materiale si stacca dalla
   * visita medica: là `visita_consegna_coerente` vieta la data di consegna su un
   * certificato non consegnato. Qui nessuna delle due va vietata — la taglia si
   * raccoglie per ordinare la fornitura, settimane prima di consegnarla, e a
   * volte il materiale si consegna senza che nessuno abbia annotato la misura.
   */
  it('ammette la taglia senza la consegna: è lo stato di metà stagione', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    await impostaMateriale(db, id, { consegnato: false, taglia: 'L' })
    expect(await tesseramentoPerId(db, id)).toMatchObject({
      materialeConsegnato: false,
      materialeTaglia: 'L',
    })
  })

  it('ammette la consegna senza la taglia', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    await impostaMateriale(db, id, { consegnato: true, taglia: null })
    expect(await tesseramentoPerId(db, id)).toMatchObject({
      materialeConsegnato: true,
      materialeTaglia: null,
    })
  })

  it('negare la consegna non cancella la taglia già presa', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    await impostaMateriale(db, id, { consegnato: true, taglia: 'XL' })
    await impostaMateriale(db, id, { consegnato: false, taglia: 'XL' })
    expect((await tesseramentoPerId(db, id))?.materialeTaglia).toBe('XL')
  })

  it('l\'elenco della stagione porta il materiale sulla riga', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id, stagioneId } = await tesserato()
    await impostaMateriale(db, id, { consegnato: true, taglia: 'S' })

    // La colonna dell'elenco non passa da una vista: se `CAMPI` in
    // lib/repos/tesseramenti.ts perdesse le due colonne, la tabella mostrerebbe
    // "No" per tutti senza che nulla fallisca.
    const elenco = await elencaTesseramenti(db, stagioneId)
    expect(elenco.find((t) => t.id === id)).toMatchObject({
      materialeConsegnato: true,
      materialeTaglia: 'S',
    })
  })

  it('è negato all\'allenatore, anche sui propri', async () => {
    const stagioneId = await creaStagione()
    const squadraId = await creaSquadra(stagioneId, { nome: `Sua ${marca()}` })
    const id = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Suo${marca()}` }),
      stagioneId,
      squadraId,
      visitaScadenza: null,
    })
    const mister = await clientPerRuolo('allenatore')
    await creaIncarico({ personaId: mister.personaId!, stagioneId, squadraId })

    // Legge — sapere chi ha le divise è il suo mestiere — ma non scrive.
    expect((await tesseramentoPerId(mister.db, id))?.materialeConsegnato).toBe(false)
    await impostaMateriale(mister.db, id, { consegnato: true, taglia: 'M' })
    const dirigente = await clientPerRuolo('dirigente')
    expect(await tesseramentoPerId(dirigente.db, id)).toMatchObject({
      materialeConsegnato: false,
      materialeTaglia: null,
    })
  })

  it('è negato su stagione chiusa', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const chiusa = await creaStagione({ stato: 'chiusa' })
    const id = await creaTesseramento({
      personaId: await creaPersona({ cognome: `Vecchio${marca()}` }),
      stagioneId: chiusa,
      visitaScadenza: null,
    })
    await impostaMateriale(db, id, { consegnato: true, taglia: 'M' })
    expect((await tesseramentoPerId(db, id))?.materialeConsegnato).toBe(false)
  })
})

describe('vincolo materiale_taglia_ammessa', () => {
  /*
   * Il test che tiene insieme le due copie della scala. TAGLIE riempie il menù e
   * lo schema zod, il vincolo SQL è la barriera vera: aggiungere una taglia in
   * TypeScript senza la migration fa fallire questo, invece di far arrivare alla
   * segreteria un 400 mentre registra le consegne.
   */
  it('ogni taglia dell\'elenco è accettata dal database', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    for (const taglia of TAGLIE) {
      await impostaMateriale(db, id, { consegnato: true, taglia })
      expect((await tesseramentoPerId(db, id))?.materialeTaglia).toBe(taglia)
    }
  })

  it('una taglia fuori scala è rifiutata dal database', async () => {
    const { db } = await clientPerRuolo('dirigente')
    const { id } = await tesserato()
    // Scavalca lo schema zod, che la fermerebbe prima: qui si verifica la
    // barriera sotto, quella che regge anche se un'azione futura dimenticasse
    // di validare.
    await expect(
      impostaMateriale(db, id, { consegnato: true, taglia: 'media' }),
    ).rejects.toThrow(/materiale_taglia_ammessa/)
  })
})
