import { describe, expect, it } from 'vitest'
import { schemaPersona } from '@/lib/validation/persona'

const minimo = { nome: 'Mario', cognome: 'Rossi' }

function analizza(dati: Record<string, unknown>) {
  return schemaPersona.safeParse({ ...minimo, ...dati })
}

describe('schemaPersona', () => {
  it('accetta i soli campi obbligatori', () => {
    const esito = analizza({})
    expect(esito.success).toBe(true)
    expect(esito.data).toMatchObject({ nome: 'Mario', cognome: 'Rossi', dataNascita: null })
  })

  it('rifiuta nome e cognome vuoti', () => {
    expect(analizza({ nome: '   ' }).success).toBe(false)
    expect(analizza({ cognome: '' }).success).toBe(false)
  })

  it('accetta la data di nascita assente (facoltativa), ma rifiuta una malformata', () => {
    const vuota = analizza({ dataNascita: '' })
    expect(vuota.success).toBe(true)
    expect(vuota.data?.dataNascita).toBeNull()
    expect(analizza({ dataNascita: '2012-05-14' }).data?.dataNascita).toBe('2012-05-14')
    expect(analizza({ dataNascita: '14/05/2012' }).success).toBe(false)
  })

  it('trasforma il codice fiscale vuoto in null, non in stringa vuota', () => {
    // persone.codice_fiscale è unique e nullable: due stringhe vuote
    // collidono, due null no. È il caso dei minori senza codice fiscale, che
    // sono la maggioranza dell'anagrafica.
    expect(analizza({ codiceFiscale: '' }).data?.codiceFiscale).toBeNull()
    expect(analizza({ codiceFiscale: '   ' }).data?.codiceFiscale).toBeNull()
    expect(analizza({}).data?.codiceFiscale).toBeNull()
  })

  it('normalizza il codice fiscale in maiuscolo', () => {
    expect(analizza({ codiceFiscale: ' rssmra12e14f257k ' }).data?.codiceFiscale).toBe(
      'RSSMRA12E14F257K',
    )
  })

  it('rifiuta un codice fiscale di lunghezza sbagliata', () => {
    expect(analizza({ codiceFiscale: 'RSSMRA12E14F257' }).success).toBe(false)
    expect(analizza({ codiceFiscale: 'RSSMRA12E14F257KK' }).success).toBe(false)
  })

  it('svuota in null anche gli altri campi facoltativi', () => {
    const esito = analizza({ email: '', telefono: '  ', citta: '', note: '' })
    expect(esito.data).toMatchObject({ email: null, telefono: null, citta: null, note: null })
  })

  it('valida email, CAP e provincia solo quando sono valorizzati', () => {
    expect(analizza({ email: 'non-una-email' }).success).toBe(false)
    expect(analizza({ email: 'mario@example.com' }).success).toBe(true)
    expect(analizza({ cap: '4112' }).success).toBe(false)
    expect(analizza({ cap: '41011' }).success).toBe(true)
    expect(analizza({ provincia: 'MOD' }).success).toBe(false)
    expect(analizza({ provincia: 'mo' }).data?.provincia).toBe('MO')
  })
})
