import { describe, expect, it } from 'vitest'
import { coloreMateriale, descrizioneMateriale, TAGLIE } from '@/lib/domain/materiale'
import { schemaMateriale } from '@/lib/validation/tesseramento'

describe('descrizioneMateriale', () => {
  /*
   * Le quattro combinazioni esistono tutte, perché consegna e taglia sono fatti
   * indipendenti: se una diventasse impossibile sarebbe un vincolo del database,
   * e questo test sarebbe il posto dove accorgersene.
   */
  it.each([
    [true, 'M', 'Consegnato · taglia M'],
    [true, null, 'Consegnato, taglia non registrata'],
    [false, 'M', 'Da consegnare · taglia M'],
    [false, null, 'Non consegnato, taglia da chiedere'],
  ])('consegnato=%s taglia=%s', (consegnato, taglia, atteso) => {
    expect(descrizioneMateriale({ consegnato, taglia })).toBe(atteso)
  })
})

describe('coloreMateriale', () => {
  it('i tre colori dicono quanto lavoro resta', () => {
    expect(coloreMateriale({ consegnato: true, taglia: 'M' })).toContain('green')
    expect(coloreMateriale({ consegnato: true, taglia: null })).toContain('green')
    // Taglia presa, consegna da fare: c'è un passo, non due.
    expect(coloreMateriale({ consegnato: false, taglia: 'M' })).toContain('amber')
    expect(coloreMateriale({ consegnato: false, taglia: null })).toContain('red')
  })
})

describe('schemaMateriale', () => {
  it('la stringa vuota del menù diventa null, non \'\'', () => {
    const esito = schemaMateriale.parse({ consegnato: 'no', taglia: '' })
    expect(esito).toEqual({ consegnato: false, taglia: null })
  })

  it('normalizza in maiuscolo: \'m\' è la stessa taglia di \'M\'', () => {
    expect(schemaMateriale.parse({ consegnato: 'si', taglia: 'm' }).taglia).toBe('M')
  })

  it('accetta tutte le taglie della scala', () => {
    for (const taglia of TAGLIE) {
      expect(schemaMateriale.parse({ consegnato: 'si', taglia }).taglia).toBe(taglia)
    }
  })

  it('rifiuta una taglia fuori scala', () => {
    expect(schemaMateriale.safeParse({ consegnato: 'si', taglia: 'media' }).success).toBe(false)
  })

  /*
   * Il SÌ/NO non ha un valore di riposo: un campo assente è un form rotto o una
   * richiesta costruita a mano, non un "no". Vedi lo stesso caso su schemaVisita.
   */
  it('rifiuta la consegna non dichiarata', () => {
    expect(schemaMateriale.safeParse({ consegnato: null, taglia: 'M' }).success).toBe(false)
  })
})
