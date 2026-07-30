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
