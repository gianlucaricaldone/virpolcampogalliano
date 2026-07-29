import { describe, expect, it } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'

describe('etichettaDaCodice', () => {
  it.each([
    ['2026-27', '2026/2027'],
    ['2025-26', '2025/2026'],
    ['1999-00', '1999/1900'],
  ])('%s diventa %s', (codice, atteso) => {
    expect(etichettaDaCodice(codice)).toBe(atteso)
  })
})
