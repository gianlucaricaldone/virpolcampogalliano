import type { Database } from '@/lib/db/types'

type StatoPresenza = Database['public']['Enums']['stato_presenza']

/**
 * Il colore dello stato scelto sul foglio presenze.
 *
 * Prima i quattro pulsanti si accendevano tutti dello stesso blu: per sapere
 * cosa si era segnato bisognava leggere la lettera, e su un foglio da venticinque
 * righe compilato col pollice a bordo campo quella lettura non si fa. Ora il
 * colore dice il significato e la lettera resta a dirlo di nuovo — il colore non
 * è mai il solo canale, e `aria-pressed` con l'etichetta completa copre chi non
 * lo vede affatto.
 *
 * Il testo cambia colore con lo sfondo perché il contrasto lo richiede: bianco
 * su ambra-500 starebbe intorno a 3:1, sotto la soglia, mentre nero sullo stesso
 * ambra supera 8:1 — ed è anche il tono delle pastiglie ambra che l'applicazione
 * già usa per "parziale" e "in scadenza".
 */
export const COLORE_PRESENZA: Record<StatoPresenza, string> = {
  presente: 'bg-green-700 text-white',
  assente: 'bg-red-700 text-white',
  giustificato: 'bg-amber-500 text-neutral-900',
  // Azzurro e non il blu societario: quello è il colore della cromatura — la
  // barra, i pulsanti primari — e riusarlo qui farebbe sembrare "infortunato"
  // lo stato predefinito.
  infortunato: 'bg-sky-700 text-white',
}
