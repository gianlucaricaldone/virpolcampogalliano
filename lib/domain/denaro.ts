const FORMATO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

/** Solo formattazione: nessuna regola di stato quota vive qui. */
export function formattaEuro(importo: number): string {
  return FORMATO.format(importo)
}

/**
 * Numero digitato all'italiana: la virgola è il separatore decimale, e il
 * punto è quello delle migliaia. `Number('250,50')` darebbe NaN e
 * `Number('1.250')` darebbe 1.25 — cioè un errore silenzioso di tre ordini di
 * grandezza su un importo.
 */
export function numeroDaTesto(testo: string): number | null {
  const pulito = testo.trim().replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  if (pulito === '') return null
  const numero = Number(pulito)
  return Number.isFinite(numero) ? numero : null
}
