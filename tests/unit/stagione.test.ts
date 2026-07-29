import { describe, expect, it } from 'vitest'
import { etichettaDaCodice, stagioneCorrenteDa } from '@/lib/domain/stagione'

describe('etichettaDaCodice', () => {
  it.each([
    ['2026-27', '2026/2027'],
    ['2025-26', '2025/2026'],
    ['1999-00', '1999/1900'],
  ])('%s diventa %s', (codice, atteso) => {
    expect(etichettaDaCodice(codice)).toBe(atteso)
  })
})

describe('stagioneCorrenteDa', () => {
  it('restituisce null su un array vuoto', () => {
    expect(stagioneCorrenteDa([])).toBeNull()
  })

  it('restituisce null se sono tutte chiuse', () => {
    const stagioni = [{ stato: 'chiusa' as const, dataInizio: '2025-09-01', codice: '2025-26' }]
    expect(stagioneCorrenteDa(stagioni)).toBeNull()
  })

  it('sceglie l\'aperta più recente per data di inizio', () => {
    const vecchia = { stato: 'aperta' as const, dataInizio: '2025-09-01', codice: '2025-26' }
    const recente = { stato: 'aperta' as const, dataInizio: '2026-09-01', codice: '2026-27' }
    expect(stagioneCorrenteDa([vecchia, recente])).toBe(recente)
  })

  // Il caso che ha prodotto il bug nel vecchio sistema: una stagione più
  // recente ma chiusa non deve prevalere su una più vecchia ma ancora aperta.
  it('ignora una stagione più recente se è chiusa, a favore di una più vecchia aperta', () => {
    const vecchiaAperta = { stato: 'aperta' as const, dataInizio: '2025-09-01', codice: '2025-26' }
    const recenteChiusa = { stato: 'chiusa' as const, dataInizio: '2026-09-01', codice: '2026-27' }
    expect(stagioneCorrenteDa([vecchiaAperta, recenteChiusa])).toBe(vecchiaAperta)
  })

  it('non dipende dall\'ordine di ingresso dell\'array', () => {
    const vecchia = { stato: 'aperta' as const, dataInizio: '2025-09-01', codice: '2025-26' }
    const recente = { stato: 'aperta' as const, dataInizio: '2026-09-01', codice: '2026-27' }
    expect(stagioneCorrenteDa([vecchia, recente])).toBe(recente)
    expect(stagioneCorrenteDa([recente, vecchia])).toBe(recente)
  })

  // Due stagioni con la stessa dataInizio potrebbero arrivare in ordini
  // diversi da elencaStagioni() e da NavBackoffice.tsx, che eseguono ciascuno
  // la propria query: senza un tiebreak esplicito, i due punti che usano
  // questa funzione potrebbero scegliere due stagioni "correnti" diverse.
  it('a parità di dataInizio, sceglie il codice più alto, indipendentemente dall\'ordine', () => {
    const a = { stato: 'aperta' as const, dataInizio: '2026-09-01', codice: '2026-27' }
    const b = { stato: 'aperta' as const, dataInizio: '2026-09-01', codice: '2027-28' }
    expect(stagioneCorrenteDa([a, b])).toBe(b)
    expect(stagioneCorrenteDa([b, a])).toBe(b)
  })
})
