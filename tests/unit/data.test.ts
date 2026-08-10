import { describe, expect, it } from 'vitest'
import { etichettaMese } from '@/lib/domain/data'

describe('etichettaMese', () => {
  it.each([
    ['2025-10-01', 'ottobre 2025'],
    ['2026-01-01', 'gennaio 2026'],
    ['2025-12-01', 'dicembre 2025'],
  ])('%s diventa %s', (iso, atteso) => {
    expect(etichettaMese(iso)).toBe(atteso)
  })

  /*
   * Il caso per cui i nomi dei mesi stanno in una tabella invece di venire da
   * `Intl.DateTimeFormat`: `new Date('2025-10-01')` è mezzanotte UTC, e
   * formattarla in un fuso a ovest di Greenwich darebbe settembre. Un'etichetta
   * di mese non deve dipendere da dove gira il server, ed è lo stesso motivo
   * documentato su `formattaData`.
   */
  it('non slitta al mese precedente', () => {
    expect(etichettaMese('2025-10-01')).toContain('ottobre')
    expect(etichettaMese('2025-01-01')).toContain('gennaio')
  })

  it('restituisce la stringa grezza se il mese non esiste', () => {
    expect(etichettaMese('2025-13-01')).toBe('2025-13-01')
  })
})
