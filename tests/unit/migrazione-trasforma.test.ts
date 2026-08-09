import { describe, expect, it } from 'vitest'
import {
  analizzaQuote,
  chiavePersona,
  trasformaStagione,
  trasformaTesserati,
  trasformaStaff,
  fondiTesseramenti,
  NOTA_RICOSTRUITO,
  ricostruisciPagamenti,
  raggruppaPresenze,
} from '@/scripts/migrazione/trasforma'

const STAGIONE = {
  id: 'v-1',
  nome: '2024/2025',
  data_inizio: '2024-09-01',
  data_fine: '2025-06-30',
  archiviata: true,
}

describe('trasformaStagione', () => {
  it("da '2024/2025' ricava codice, etichetta e stato", () => {
    const esito = trasformaStagione(STAGIONE)
    expect(esito).toEqual({
      ok: true,
      stagione: {
        codice: '2024-25',
        etichetta: 'Stagione 2024/2025',
        data_inizio: '2024-09-01',
        data_fine: '2025-06-30',
        stato: 'chiusa',
      },
    })
  })

  it('non archiviata resta aperta', () => {
    const esito = trasformaStagione({ ...STAGIONE, archiviata: false })
    if (!esito.ok) throw new Error('attesa stagione valida')
    expect(esito.stagione.stato).toBe('aperta')
  })

  it('un nome che non è AAAA/AAAA è anomalia, non un codice inventato', () => {
    const esito = trasformaStagione({ ...STAGIONE, nome: 'Stagione vecchia' })
    if (esito.ok) throw new Error('attesa anomalia')
    expect(esito.anomalia.tipo).toBe('stagione_nome_invalido')
    expect(esito.anomalia.id).toBe('v-1')
  })

  it('anni non consecutivi sono anomalia: il codice mentirebbe', () => {
    const esito = trasformaStagione({ ...STAGIONE, nome: '2024/2026' })
    expect(esito.ok).toBe(false)
  })
})

describe('analizzaQuote', () => {
  it('legge coppie codice=importo', () => {
    const quote = analizzaQuote(['2024-25=350', '2025-26=380.50'])
    expect(quote.get('2024-25')).toBe(350)
    expect(quote.get('2025-26')).toBe(380.5)
  })

  it('rifiuta importi non numerici o negativi', () => {
    expect(() => analizzaQuote(['2024-25=tanto'])).toThrow(/quota/i)
    expect(() => analizzaQuote(['2024-25=-5'])).toThrow(/quota/i)
  })

  it('rifiuta un codice che non è un codice stagione', () => {
    expect(() => analizzaQuote(['2024/2025=350'])).toThrow(/codice/i)
  })

  it('rifiuta importi vuoti, di soli spazi o infiniti', () => {
    expect(() => analizzaQuote(['2024-25= '])).toThrow(/quota/i)
    expect(() => analizzaQuote(['2024-25=Infinity'])).toThrow(/quota/i)
  })
})

const TESSERATO = {
  id: 't-1',
  nome: 'Marco',
  cognome: 'Rossi',
  data_nascita: '2012-03-04',
  codice_fiscale: 'RSSMRC12C04B819X',
  email: null,
  telefono: null,
  indirizzo: null,
  citta: null,
  cap: null,
}

describe('chiavePersona', () => {
  it('preferisce il codice fiscale, normalizzato', () => {
    expect(chiavePersona({ codice_fiscale: ' rssmrc12c04b819x ', cognome: 'X', nome: 'Y' }))
      .toBe('cf:RSSMRC12C04B819X')
  })

  it('senza codice fiscale usa la terna normalizzata', () => {
    expect(chiavePersona({ cognome: " D'Angelo ", nome: 'María', data_nascita: '2011-01-02' }))
      .toBe("terna:d'angelo|maría|2011-01-02")
  })
})

describe('trasformaTesserati', () => {
  it('mappa i campi anagrafici', () => {
    const { persone, anomalie } = trasformaTesserati([TESSERATO])
    expect(anomalie).toEqual([])
    expect(persone).toEqual([{
      chiave: 'cf:RSSMRC12C04B819X',
      nome: 'Marco',
      cognome: 'Rossi',
      data_nascita: '2012-03-04',
      codice_fiscale: 'RSSMRC12C04B819X',
      email: null,
      telefono: null,
      indirizzo: null,
      citta: null,
      cap: null,
    }])
  })

  it('due tesserati senza CF con la stessa terna sono anomalia, nessuno dei due migra', () => {
    const a = { ...TESSERATO, id: 't-1', codice_fiscale: null }
    const b = { ...TESSERATO, id: 't-2', codice_fiscale: null }
    const { persone, anomalie } = trasformaTesserati([a, b])
    expect(persone).toEqual([])
    expect(anomalie).toHaveLength(2)
    expect(anomalie[0].tipo).toBe('tesserato_terna_duplicata')
  })

  it('senza data di nascita è anomalia, nessuna data si inventa: persone.data_nascita è NOT NULL', () => {
    const senzaData = { ...TESSERATO, codice_fiscale: null, data_nascita: null }
    const { persone, anomalie } = trasformaTesserati([senzaData])
    expect(persone).toEqual([])
    expect(anomalie).toHaveLength(1)
    expect(anomalie[0]).toMatchObject({
      tipo: 'tesserato_senza_data_nascita',
      id: 't-1',
    })
  })

  it('con codice fiscale ma senza data di nascita è comunque anomalia: il vincolo è sulla colonna, non sulla chiave', () => {
    const conCfSenzaData = { ...TESSERATO, data_nascita: null }
    const { persone, anomalie } = trasformaTesserati([conCfSenzaData])
    expect(persone).toEqual([])
    expect(anomalie[0].tipo).toBe('tesserato_senza_data_nascita')
  })
})

describe('trasformaStaff', () => {
  const UTENTE = {
    id: 'u-1',
    email: 'mister@vecchio.test',
    role: 'allenatore',
    roles: null,
    nome: 'Luca',
    cognome: 'Bianchi',
    telefono: null,
  }

  it("l'allenatore con persona corrispondente si collega a lei", () => {
    const persone = new Map([['bianchi|luca', 'cf:BNCLCU80A01F257K']])
    const { account, anomalie } = trasformaStaff([UTENTE], persone)
    expect(anomalie).toEqual([])
    expect(account).toEqual([{
      email: 'mister@vecchio.test',
      ruolo: 'allenatore',
      personaChiave: 'cf:BNCLCU80A01F257K',
      nomePerPassword: 'Luca',
    }])
  })

  it("l'allenatore senza persona è anomalia: data di nascita non ricostruibile", () => {
    const { account, anomalie } = trasformaStaff([UTENTE], new Map())
    expect(account).toEqual([])
    expect(anomalie[0].tipo).toBe('allenatore_senza_persona')
  })

  it('admin e dirigente nascono anche senza persona', () => {
    const admin = { ...UTENTE, id: 'u-2', email: 'admin@vecchio.test', role: 'admin' }
    const { account, anomalie } = trasformaStaff([admin], new Map())
    expect(anomalie).toEqual([])
    expect(account[0]).toMatchObject({ ruolo: 'admin', personaChiave: null })
  })

  it("dall'array roles vince il ruolo più alto; vice_allenatore diventa allenatore", () => {
    const persone = new Map([['bianchi|luca', 'cf:X']])
    const doppio = { ...UTENTE, roles: ['vice_allenatore', 'dirigente'] }
    const { account } = trasformaStaff([doppio], persone)
    expect(account[0].ruolo).toBe('dirigente')
  })

  it('tesserato e genitore sono scartati senza anomalia', () => {
    const genitore = { ...UTENTE, id: 'u-3', role: 'genitore', roles: null }
    const { account, scartati, anomalie } = trasformaStaff([genitore], new Map())
    expect(account).toEqual([])
    expect(scartati).toBe(1)
    expect(anomalie).toEqual([])
  })

  it('due staff con la stessa email sono anomalia, nessun account per quella email', () => {
    const a = { ...UTENTE, id: 'u-1', role: 'dirigente' }
    const b = { ...UTENTE, id: 'u-2', role: 'admin' }
    const { account, anomalie } = trasformaStaff([a, b], new Map())
    expect(account).toEqual([])
    expect(anomalie).toHaveLength(2)
    expect(anomalie[0].tipo).toBe('staff_email_duplicata')
  })

  it('staff senza nome è anomalia: la password iniziale nasce dal nome', () => {
    const anonimo = { ...UTENTE, nome: null, role: 'dirigente' }
    const { account, anomalie } = trasformaStaff([anonimo], new Map())
    expect(account).toEqual([])
    expect(anomalie[0].tipo).toBe('staff_senza_nome')
  })
})

const RIGA_SQUADRA = {
  id: 'tss-1',
  tesserato_id: 't-1',
  squadra_id: 'sq-1',
  stagione_id: 'st-1',
  numero_maglia: 10,
  data_tesseramento: '2024-09-15',
  note: null,
}

const DATI = {
  id: 'tds-1',
  tesserato_id: 't-1',
  stagione_id: 'st-1',
  stato_pagamento: 'pagato',
  note_pagamento: null,
  visita_sportiva: true,
  scadenza_certificato: '2025-05-01',
  updated_at: '2024-10-01T10:00:00Z',
}

const PER_ID = new Map([['t-1', 'cf:RSSMRC12C04B819X']])

describe('fondiTesseramenti', () => {
  it('fonde riga squadra e dati stagionali in un tesseramento', () => {
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA], [DATI], PER_ID)
    expect(anomalie).toEqual([])
    expect(tesseramenti).toEqual([{
      personaChiave: 'cf:RSSMRC12C04B819X',
      stagioneVecchiaId: 'st-1',
      squadraVecchiaId: 'sq-1',
      numero_maglia: 10,
      visita_scadenza: '2025-05-01',
      note: null,
    }])
  })

  it('dati stagionali senza riga squadra danno un tesseramento senza squadra', () => {
    const { tesseramenti } = fondiTesseramenti([], [DATI], PER_ID)
    expect(tesseramenti).toHaveLength(1)
    expect(tesseramenti[0].squadraVecchiaId).toBeNull()
  })

  it('più squadre nella stessa stagione sono anomalia, nessun tesseramento', () => {
    const seconda = { ...RIGA_SQUADRA, id: 'tss-2', squadra_id: 'sq-2', numero_maglia: null }
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA, seconda], [DATI], PER_ID)
    expect(tesseramenti).toEqual([])
    expect(anomalie.map((a) => a.tipo)).toEqual([
      'tesserato_multi_squadra',
      'tesserato_multi_squadra',
    ])
  })

  it('visita sportiva senza scadenza è anomalia e il tesseramento migra senza data', () => {
    const senza = { ...DATI, scadenza_certificato: null }
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA], [senza], PER_ID)
    expect(tesseramenti[0].visita_scadenza).toBeNull()
    expect(anomalie[0].tipo).toBe('visita_senza_scadenza')
  })

  it('un numero maglia fuori da 1-99 migra come nullo, con anomalia', () => {
    const strano = { ...RIGA_SQUADRA, numero_maglia: 0 }
    const { tesseramenti, anomalie } = fondiTesseramenti([strano], [DATI], PER_ID)
    expect(tesseramenti[0].numero_maglia).toBeNull()
    expect(anomalie[0].tipo).toBe('numero_maglia_invalido')
  })

  it('righe di tesserati non migrati sono ignorate qui: hanno già la loro anomalia', () => {
    const { tesseramenti, anomalie } = fondiTesseramenti(
      [{ ...RIGA_SQUADRA, tesserato_id: 't-sconosciuto' }],
      [],
      PER_ID,
    )
    expect(tesseramenti).toEqual([])
    expect(anomalie).toEqual([])
  })
})

describe('ricostruisciPagamenti', () => {
  const QUOTE = new Map([['st-1', 350]])

  it("'pagato' diventa un pagamento pari alla quota, datato updated_at", () => {
    const { pagamenti } = ricostruisciPagamenti([DATI], PER_ID, QUOTE)
    expect(pagamenti).toEqual([{
      personaChiave: 'cf:RSSMRC12C04B819X',
      stagioneVecchiaId: 'st-1',
      importo: 350,
      data: '2024-10-01',
    }])
  })

  it("'parziale' vale metà quota", () => {
    const { pagamenti } = ricostruisciPagamenti(
      [{ ...DATI, stato_pagamento: 'parziale' }], PER_ID, QUOTE,
    )
    expect(pagamenti[0].importo).toBe(175)
  })

  it("'non_pagato' e 'in_sospeso' non generano pagamenti", () => {
    const { pagamenti } = ricostruisciPagamenti(
      [
        { ...DATI, id: 'a', stato_pagamento: 'non_pagato' },
        { ...DATI, id: 'b', stato_pagamento: 'in_sospeso' },
      ],
      PER_ID,
      QUOTE,
    )
    expect(pagamenti).toEqual([])
  })

  it('uno stato di pagamento sconosciuto è anomalia', () => {
    const { pagamenti, anomalie } = ricostruisciPagamenti(
      [{ ...DATI, stato_pagamento: 'boh' }], PER_ID, QUOTE,
    )
    expect(pagamenti).toEqual([])
    expect(anomalie[0].tipo).toBe('stato_pagamento_sconosciuto')
  })

  it('con quota zero non genera pagamenti nemmeno per i pagati', () => {
    const { pagamenti, anomalie } = ricostruisciPagamenti(
      [DATI], PER_ID, new Map([['st-1', 0]]),
    )
    expect(pagamenti).toEqual([])
    expect(anomalie).toEqual([])
  })

  it('la nota fissa è esportata: il chiamante la scrive su ogni pagamento', () => {
    expect(NOTA_RICOSTRUITO).toBe('importo ricostruito dalla migrazione')
  })
})

const PRESENZA = {
  id: 'p-1',
  tesserato_id: 't-1',
  squadra_id: 'sq-1',
  stagione_id: 'st-1',
  data: '2024-10-07',
  tipo: 'allenamento',
  presente: true,
  note: null,
}
const STAGIONE_PER_SQUADRA = new Map([['sq-1', 'st-1']])

describe('raggruppaPresenze', () => {
  it('stessa squadra e stessa data diventano una seduta con le sue presenze', () => {
    const seconda = { ...PRESENZA, id: 'p-2', tesserato_id: 't-1b', presente: false }
    const perId = new Map([['t-1', 'cf:A'], ['t-1b', 'cf:B']])
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA, seconda], perId, STAGIONE_PER_SQUADRA)
    expect(anomalie).toEqual([])
    expect(sedute).toEqual([{
      squadraVecchiaId: 'sq-1',
      stagioneVecchiaId: 'st-1',
      data: '2024-10-07',
      presenze: [
        { personaChiave: 'cf:A', stato: 'presente', note: null },
        { personaChiave: 'cf:B', stato: 'assente', note: null },
      ],
    }])
  })

  it('date diverse danno sedute diverse', () => {
    const altra = { ...PRESENZA, id: 'p-2', data: '2024-10-09' }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute } = raggruppaPresenze([PRESENZA, altra], perId, STAGIONE_PER_SQUADRA)
    expect(sedute).toHaveLength(2)
  })

  it('partite, tornei ed eventi sono scartati e contati, senza anomalia', () => {
    const partita = { ...PRESENZA, id: 'p-2', tipo: 'partita' }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, scartateNonAllenamento } = raggruppaPresenze(
      [PRESENZA, partita], perId, STAGIONE_PER_SQUADRA,
    )
    expect(sedute).toHaveLength(1)
    expect(scartateNonAllenamento).toBe(1)
  })

  it('una presenza senza squadra è anomalia: non esiste seduta a cui darla', () => {
    const orfana = { ...PRESENZA, id: 'p-3', squadra_id: null }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, anomalie } = raggruppaPresenze([orfana], perId, STAGIONE_PER_SQUADRA)
    expect(sedute).toEqual([])
    expect(anomalie[0].tipo).toBe('presenza_senza_squadra')
  })

  it('una presenza la cui squadra non è migrata è anomalia', () => {
    const perId = new Map([['t-1', 'cf:A']])
    const { anomalie } = raggruppaPresenze([PRESENZA], perId, new Map())
    expect(anomalie[0].tipo).toBe('presenza_squadra_non_migrata')
  })

  it('duplicati stesso tesserato/seduta: vince la prima riga, la seconda è anomalia', () => {
    const doppione = { ...PRESENZA, id: 'p-2', presente: false }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA, doppione], perId, STAGIONE_PER_SQUADRA)
    expect(sedute[0].presenze).toHaveLength(1)
    expect(sedute[0].presenze[0].stato).toBe('presente')
    expect(anomalie[0].tipo).toBe('presenza_duplicata')
  })

  it('presenze di tesserati non migrati sono ignorate: hanno già la loro anomalia', () => {
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA], new Map(), STAGIONE_PER_SQUADRA)
    expect(sedute).toEqual([])
    expect(anomalie).toEqual([])
  })
})
