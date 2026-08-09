import { describe, expect, it } from 'vitest'
import { analizzaQuote, trasformaStagione } from '@/scripts/migrazione/trasforma'

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
})
