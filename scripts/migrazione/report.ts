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

/** Una cella markdown non può contenere pipe né a capo: arrivano dai dati vecchi. */
function cella(testo: string | number): string {
  return String(testo).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
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
      `| ${cella(tabella)} | ${c.lette} | ${c.migrate} | ${c.giaPresenti} | ${c.scartate} | ${cella(c.motivoScarti ?? '')} |`,
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
      righe.push(`| ${cella(a.tipo)} | ${cella(a.id)} | ${cella(a.chiave)} | ${cella(a.dettaglio)} |`)
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
      righe.push(`| ${cella(a.email)} | ${cella(a.password)} |`)
    }
    righe.push('')
  }

  return righe.join('\n')
}
