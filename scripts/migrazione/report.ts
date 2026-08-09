import type { Anomalia } from './tipi'

export type ContoTabella = {
  lette: number
  migrate: number
  giaPresenti: number
  scartate: number
  motivoScarti?: string
}

export type DatiReport = {
  dryRun: boolean
  conteggi: Record<string, ContoTabella>
  anomalie: Anomalia[]
  account: { email: string; password: string }[]
}

/**
 * Il report è l'output principale dello script: si legge PRIMA di decidere
 * di eseguire. Markdown perché si legge nell'editor e si allega com'è.
 */
export function generaReport(dati: DatiReport): string {
  const righe: string[] = []
  righe.push('# Report di migrazione')
  righe.push('')
  righe.push(
    dati.dryRun
      ? '**Dry-run: nessuna scrittura eseguita.** Questo report descrive cosa farebbe `--esegui`.'
      : `**Eseguita** il ${new Date().toISOString()}.`,
  )
  righe.push('')

  righe.push('## Conteggi')
  righe.push('')
  righe.push('| tabella | lette | da migrare | già presenti | scartate | motivo scarti |')
  righe.push('|---|---|---|---|---|---|')
  for (const [tabella, c] of Object.entries(dati.conteggi)) {
    righe.push(
      `| ${tabella} | ${c.lette} | ${c.migrate} | ${c.giaPresenti} | ${c.scartate} | ${c.motivoScarti ?? ''} |`,
    )
  }
  righe.push('')

  righe.push('## Anomalie')
  righe.push('')
  if (dati.anomalie.length === 0) {
    righe.push('Nessuna anomalia.')
  } else {
    righe.push('Da decidere caso per caso nel vecchio sistema. Lo script non ripara mai.')
    righe.push('')
    righe.push('| tipo | id vecchio | chiave | dettaglio |')
    righe.push('|---|---|---|---|')
    for (const a of dati.anomalie) {
      righe.push(`| ${a.tipo} | ${a.id} | ${a.chiave} | ${a.dettaglio} |`)
    }
  }
  righe.push('')

  if (dati.account.length > 0) {
    righe.push('## Account creati')
    righe.push('')
    righe.push('Password iniziali da comunicare **a voce**, mai per iscritto.')
    righe.push('')
    righe.push('| email | password iniziale |')
    righe.push('|---|---|')
    for (const a of dati.account) {
      righe.push(`| ${a.email} | ${a.password} |`)
    }
    righe.push('')
  }

  return righe.join('\n')
}
