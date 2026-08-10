import type { StatoQuota } from '@/lib/repos/quote'

/**
 * Etichette e colori dello stato di una quota. Non calcolano niente: lo stato
 * lo decide `v_quote`, qui si traduce in una parola e in un colore.
 *
 * Stavano dentro components/quote/TabellaQuote.tsx. Da quando la rosa della
 * scheda squadra mostra la stessa informazione servono in due posti, e due
 * copie di una mappa di etichette divergono al primo ripensamento: l'elenco
 * direbbe "non pagato" e la rosa "da pagare" per lo stesso stato.
 */
export const ETICHETTA_QUOTA: Record<StatoQuota, string> = {
  non_pagato: 'non pagato',
  parziale: 'parziale',
  saldato: 'saldato',
}

export const COLORE_QUOTA: Record<StatoQuota, string> = {
  non_pagato: 'bg-red-100 text-red-900',
  parziale: 'bg-amber-100 text-amber-900',
  saldato: 'bg-green-100 text-green-900',
}
