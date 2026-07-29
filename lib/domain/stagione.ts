/**
 * Etichetta leggibile a partire dal codice: '2026-27' -> '2026/2027'.
 * Il codice ha forma garantita dal vincolo stagioni_codice_forma.
 */
export function etichettaDaCodice(codice: string): string {
  const inizio = codice.slice(0, 4)
  const fine = codice.slice(5)
  return `${inizio}/${inizio.slice(0, 2)}${fine}`
}
