import { describe, expect, it } from 'vitest'
import { formattaData } from '@/lib/domain/data'
import { descrizioneVisita } from '@/lib/domain/visita'

describe('formattaData', () => {
  it('mette la data nella forma italiana', () => {
    expect(formattaData('2014-03-21')).toBe('21/03/2014')
  })

  it('non inventa una data quando non c\'è', () => {
    expect(formattaData(null)).toBe('—')
  })
})

describe('descrizioneVisita', () => {
  it('distingue il non registrato dallo scaduto', () => {
    expect(descrizioneVisita({ stato: 'mancante', giorniAllaScadenza: null, scadenza: null }))
      .toBe('Nessuna visita registrata')
    expect(descrizioneVisita({ stato: 'scaduta', giorniAllaScadenza: -12, scadenza: '2026-01-01' }))
      .toBe('Scaduta da 12 giorni')
  })

  it('usa il singolare dove serve', () => {
    expect(descrizioneVisita({ stato: 'scaduta', giorniAllaScadenza: -1, scadenza: '2026-01-01' }))
      .toBe('Scaduta da 1 giorno')
    expect(descrizioneVisita({ stato: 'in_scadenza', giorniAllaScadenza: 1, scadenza: '2026-01-01' }))
      .toBe('Scade domani')
  })

  it('il giorno stesso della scadenza dice "oggi", non "fra 0 giorni"', () => {
    expect(descrizioneVisita({ stato: 'in_scadenza', giorniAllaScadenza: 0, scadenza: '2026-01-01' }))
      .toBe('Scade oggi')
  })

  it('per una visita valida dice fino a quando', () => {
    expect(descrizioneVisita({ stato: 'valida', giorniAllaScadenza: 200, scadenza: '2027-04-15' }))
      .toBe('Valida fino al 15/04/2027')
  })
})
