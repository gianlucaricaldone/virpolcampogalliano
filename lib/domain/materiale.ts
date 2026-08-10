/**
 * Le taglie ammesse, in ordine dalla più piccola. **Devono coincidere con il
 * vincolo `materiale_taglia_ammessa`** della migration 20260810000200: qui
 * riempiono il menù e lo schema zod, là sono la barriera vera. Il test
 * "ogni taglia dell'elenco è accettata dal database" in tests/db
 * scorre questo array, quindi aggiungerne una qui senza la migration diventa
 * rosso invece di diventare un 400 in faccia alla segreteria.
 *
 * L'ordine è quello della scala, non alfabetico: un menù che va da 2XL a XS
 * costringe a leggerlo tutto ogni volta.
 */
export const TAGLIE = ['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const

export type Taglia = (typeof TAGLIE)[number]

type Materiale = { consegnato: boolean; taglia: string | null }

/**
 * Solo formattazione. Consegna e taglia sono indipendenti — si registra la
 * taglia per ordinare la fornitura, settimane prima di consegnarla — quindi le
 * quattro combinazioni esistono tutte e ognuna vuole una frase diversa: dire
 * "non consegnato" senza aggiungere che la taglia è già stata presa manderebbe
 * a chiederla di nuovo.
 */
export function descrizioneMateriale(materiale: Materiale): string {
  if (materiale.consegnato) {
    return materiale.taglia
      ? `Consegnato · taglia ${materiale.taglia}`
      : 'Consegnato, taglia non registrata'
  }
  return materiale.taglia
    ? `Da consegnare · taglia ${materiale.taglia}`
    : 'Non consegnato, taglia da chiedere'
}

/**
 * Verde a consegna fatta, ambra quando manca solo la consegna, rosso quando
 * non si sa nemmeno la taglia: i tre colori dicono quanto lavoro resta, che è
 * la domanda per cui si guarda questa colonna. Gli stessi tre di
 * COLORE_QUOTA, perché in tabella stanno nella riga accanto.
 */
export function coloreMateriale(materiale: Materiale): string {
  if (materiale.consegnato) return 'bg-green-100 text-green-900'
  return materiale.taglia ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
}
