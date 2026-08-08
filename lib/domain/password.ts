const SUFFISSO = '_VIRPOL_1234'

/**
 * Password iniziale di un utente nuovo, dallo schema deciso dalla società:
 * nome di battesimo più suffisso fisso.
 *
 * È indovinabile — chi conosce il nome di un allenatore e la convenzione entra
 * al suo posto — ed è una scelta consapevole del committente, documentata in
 * docs/superpowers/specs/2026-07-30-gestione-utenti-design.md. Se un giorno
 * l'applicazione uscirà dalla singola società, si sostituisce questa funzione
 * con un generatore casuale e non cambia altro.
 */
export function passwordIniziale(nome: string): string {
  const base = nome
    .normalize('NFD')                  // separa le lettere dai segni diacritici
    .replace(/[̀-ͯ]/g, '')   // e li toglie
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return `${base || 'utente'}${SUFFISSO}`
}
