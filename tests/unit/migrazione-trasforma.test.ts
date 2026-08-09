import { describe, expect, it } from 'vitest'
import {
  analizzaQuote,
  chiavePersona,
  trasformaStagione,
  trasformaTesserati,
  trasformaStaff,
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
