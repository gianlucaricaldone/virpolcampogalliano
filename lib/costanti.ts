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
