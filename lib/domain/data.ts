/**
 * Data ISO (aaaa-mm-gg) nella forma italiana gg/mm/aaaa.
 *
 * Manipolazione di stringa e non `Intl.DateTimeFormat`: `new Date('2014-03-21')`
 * è mezzanotte UTC, e formattarla in un fuso a ovest di Greenwich
 * restituirebbe il giorno prima. Una data di nascita non ha un'ora, e non deve
 * cambiare a seconda di dove gira il server.
 */
export function formattaData(iso: string | null): string {
  if (!iso) return '—'
  const [anno, mese, giorno] = iso.split('-')
  if (!anno || !mese || !giorno) return iso
  return `${giorno}/${mese}/${anno}`
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

/**
 * Primo giorno del mese (aaaa-mm-01) nella forma «ottobre 2025».
 *
 * Nomi in tabella e non `Intl.DateTimeFormat`, per la stessa ragione di
 * `formattaData`: costruire una Date da una stringa ISO la interpreta come
 * mezzanotte UTC, e in un fuso a ovest di Greenwich «2025-10-01» diventerebbe
 * settembre. Un'etichetta di mese non deve dipendere da dove gira il server.
 */
export function etichettaMese(iso: string): string {
  const [anno, mese] = iso.split('-')
  const nome = MESI[Number(mese) - 1]
  return nome ? `${nome} ${anno}` : iso
}
