/**
 * Etichetta leggibile a partire dal codice: '2026-27' -> '2026/2027'.
 * Il codice ha forma garantita dal vincolo stagioni_codice_forma.
 */
export function etichettaDaCodice(codice: string): string {
  const inizio = codice.slice(0, 4)
  const fine = codice.slice(5)
  return `${inizio}/${inizio.slice(0, 2)}${fine}`
}

/** Le sole proprietà su cui la regola si basa: chi la chiama può passare un tipo più ricco. */
type StagioneMinima = { stato: 'aperta' | 'chiusa'; dataInizio: string; codice: string }

/**
 * Stagione corrente: la prima aperta ordinata per data di inizio decrescente,
 * a parità di data di inizio la prima per codice decrescente. Unica
 * implementazione della regola — prima viveva sia in una query
 * (lib/repos/stagioni.ts) sia in un .find() su NavBackoffice.tsx, e i due
 * concordavano solo perché elencaStagioni ordina per data_inizio desc: un
 * riordino avrebbe fatto puntare la nav a una stagione diversa da quella su
 * cui /gestione reindirizza, senza che nulla fallisse. Non presuppone che
 * l'array in ingresso sia ordinato: due stagioni con la stessa dataInizio
 * altrimenti farebbero decidere l'ordine d'arrivo, che Postgres non
 * garantisce tra le due query separate che i due chiamanti eseguono.
 */
export function stagioneCorrenteDa<T extends StagioneMinima>(stagioni: T[]): T | null {
  const aperte = stagioni.filter((s) => s.stato === 'aperta')
  if (aperte.length === 0) return null
  return aperte.reduce((piuRecente, s) => {
    if (s.dataInizio !== piuRecente.dataInizio) return s.dataInizio > piuRecente.dataInizio ? s : piuRecente
    return s.codice > piuRecente.codice ? s : piuRecente
  })
}
