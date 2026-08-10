import type { Database } from '@/lib/db/types'

/**
 * Costanti condivise fra server e client.
 *
 * **Questo modulo non importa nulla a runtime**, e non è una coincidenza: è
 * ciò che lo rende sicuro da importare da un componente client. Prima queste
 * quattro vivevano dentro `lib/validation/*` e `lib/repos/*`, e ogni form che
 * ne leggeva una si trascinava nel browser il modulo intero — cioè zod, per
 * ottenere otto stringhe. Misurato: 63 KB di chunk su tre rotte.
 *
 * Le annotazioni di tipo usano `import type`, che il compilatore cancella: non
 * arriva niente di `lib/db/types.ts` nel bundle.
 */

/** Categorie federali, come suggerimento: la colonna resta testo libero. */
export const CATEGORIE = [
  'Piccoli Amici',
  'Primi Calci',
  'Pulcini',
  'Esordienti',
  'Giovanissimi',
  'Allievi',
  'Juniores',
  'Prima squadra',
] as const

/**
 * La sede, in un posto solo.
 *
 * Prima l'indirizzo era scritto tre volte — footer, /contatti, /dove-siamo — e
 * gli orari di segreteria, scritti anch'essi tre volte, erano già **divergenti**:
 * il footer diceva 18:00-20:00, /dove-siamo 16:00-22:00, /contatti Domenica
 * chiuso contro «solo durante partite». Tre copie di un dato non restano uguali,
 * e il primo a cambiarne una non sa dove sono le altre.
 *
 * `ricerca` è la stringa che finisce nei link di navigazione: nome del centro
 * più via più comune, perché è quello che Maps e Waze risolvono meglio di un
 * indirizzo secco.
 */
export const SEDE = {
  centro: 'Centro Sportivo «Lauro Bolelli»',
  via: 'Via Enrico Mattei 15',
  comune: '41011 Campogalliano (MO)',
  ricerca: 'Centro Sportivo Lauro Bolelli, Via Enrico Mattei 15, Campogalliano',
} as const

/**
 * I due link di navigazione verso la sede. Funzioni e non stringhe costanti
 * perché la codifica dell'indirizzo è la parte che si sbaglia: `Via Enrico
 * Mattei 15` con gli spazi grezzi dentro una query string dà un link che in
 * qualche client si tronca al primo spazio. Prima qui c'erano
 * `https://maps.google.com` e `https://waze.com`, cioè le due homepage: non
 * portavano da nessuna parte.
 */
export function linkGoogleMaps(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SEDE.ricerca)}`
}

export function linkWaze(): string {
  return `https://waze.com/ul?q=${encodeURIComponent(SEDE.ricerca)}&navigate=yes`
}

export const METODI = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'bonifico', etichetta: 'Bonifico' },
  { valore: 'altro', etichetta: 'Altro' },
] as const

export const RUOLI_STAFF: {
  valore: Database['public']['Enums']['ruolo_staff']
  etichetta: string
}[] = [
  { valore: 'allenatore', etichetta: 'Allenatore' },
  { valore: 'vice_allenatore', etichetta: 'Vice allenatore' },
  { valore: 'dirigente_squadra', etichetta: 'Dirigente di squadra' },
]

export const STATI_PRESENZA: {
  valore: Database['public']['Enums']['stato_presenza']
  etichetta: string
  breve: string
}[] = [
  { valore: 'presente', etichetta: 'Presente', breve: 'P' },
  { valore: 'assente', etichetta: 'Assente', breve: 'A' },
  { valore: 'giustificato', etichetta: 'Giustificato', breve: 'G' },
  { valore: 'infortunato', etichetta: 'Infortunato', breve: 'I' },
]
