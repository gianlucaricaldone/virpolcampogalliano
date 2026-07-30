import { describe, expect, it } from 'vitest'
import { formattaEuro, numeroDaTesto } from '@/lib/domain/denaro'

/**
 * Intl separa importo e simbolo con uno spazio non separabile (U+00A0). Un
 * test che lo scrivesse come spazio normale fallirebbe per un carattere
 * invisibile, e chi lo legge non vedrebbe la differenza: qui si normalizza,
 * così l'asserzione parla di cifre e non di codepoint.
 */
function normalizza(testo: string): string {
  return testo.replace(/ /g, ' ')
}

describe('formattaEuro', () => {
  it('formatta all\'italiana', () => {
    expect(normalizza(formattaEuro(250))).toBe('250,00 €')
    // Nessun separatore delle migliaia a quattro cifre: l'italiano segue la
    // regola CLDR "min2" e il punto compare da cinque cifre in su. Non è un
    // difetto di formattazione, ed è scritto qui perché il prossimo lettore
    // non lo "aggiusti" con useGrouping: 'always'.
    expect(normalizza(formattaEuro(1250.5))).toBe('1250,50 €')
    expect(normalizza(formattaEuro(12500))).toBe('12.500,00 €')
  })

  it('un credito resta negativo, non diventa zero', () => {
    expect(normalizza(formattaEuro(-50))).toBe('-50,00 €')
  })
})

describe('numeroDaTesto', () => {
  it('accetta la virgola come separatore decimale', () => {
    expect(numeroDaTesto('250,50')).toBe(250.5)
    expect(numeroDaTesto('250.50')).toBe(250.5)
  })

  it('accetta il punto come separatore delle migliaia', () => {
    // Number('1.250') darebbe 1.25: tre ordini di grandezza in silenzio.
    expect(numeroDaTesto('1.250')).toBe(1250)
    expect(numeroDaTesto('1.250,75')).toBe(1250.75)
  })

  it('restituisce null per il vuoto e per ciò che non è un numero', () => {
    expect(numeroDaTesto('')).toBeNull()
    expect(numeroDaTesto('   ')).toBeNull()
    expect(numeroDaTesto('duecento')).toBeNull()
  })
})
