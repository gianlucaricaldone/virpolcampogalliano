import { describe, expect, it } from 'vitest'
import { generaReport } from '@/scripts/migrazione/report'

const BASE = {
  dryRun: true,
  conteggi: {
    stagioni: { lette: 3, migrate: 2, giaPresenti: 1, scartate: 0 },
    presenze: { lette: 900, migrate: 850, giaPresenti: 0, scartate: 50, motivoScarti: 'tipo diverso da allenamento' },
  },
  anomalie: [
    { tipo: 'visita_senza_scadenza', id: 'tds-9', chiave: 'cf:X @ stagione st-1', dettaglio: 'senza scadenza' },
  ],
  account: [],
}

describe('generaReport', () => {
  it('dichiara in testa che è un dry-run', () => {
    const report = generaReport(BASE)
    expect(report).toMatch(/dry-run/i)
    expect(report).toMatch(/nessuna scrittura/i)
  })

  it('ha una riga per tabella con tutti i conteggi', () => {
    const report = generaReport(BASE)
    expect(report).toContain('| stagioni | 3 | 2 | 1 | 0 |')
    expect(report).toContain('| presenze | 900 | 850 | 0 | 50 |')
    expect(report).toContain('tipo diverso da allenamento')
  })

  it('elenca le anomalie con tipo, id e chiave', () => {
    const report = generaReport(BASE)
    expect(report).toContain('visita_senza_scadenza')
    expect(report).toContain('tds-9')
    expect(report).toContain('cf:X @ stagione st-1')
  })

  it('senza anomalie lo dice, invece di lasciare una sezione vuota', () => {
    const report = generaReport({ ...BASE, anomalie: [] })
    expect(report).toMatch(/nessuna anomalia/i)
  })

  it('con --esegui elenca gli account creati con la password', () => {
    const report = generaReport({
      ...BASE,
      dryRun: false,
      account: [{ email: 'mister@vecchio.test', password: 'luca_VIRPOL_1234' }],
    })
    expect(report).not.toMatch(/dry-run/i)
    expect(report).toContain('mister@vecchio.test')
    expect(report).toContain('luca_VIRPOL_1234')
    expect(report).toMatch(/a voce/i)
  })

  it('pipe e a capo nei campi legacy non rompono la tabella', () => {
    const report = generaReport({
      ...BASE,
      anomalie: [{ tipo: 'x', id: 'a|b', chiave: 'c\nd', dettaglio: 'e | f' }],
    })
    expect(report).toContain('| x | a\\|b | c d | e \\| f |')
  })
})
