import { z } from 'zod'
import { facoltativo } from '@/lib/validation/comune'

export const schemaSeduta = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La data della seduta è obbligatoria'),
  // `time` accetta anche i secondi; il campo HTML manda hh:mm.
  oraInizio: facoltativo(z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Ora non valida')),
  note: facoltativo(z.string()),
})

/**
 * Le righe del foglio arrivano come argomento della Server Action, non come
 * FormData: sono una lista, e serializzarla in campi nominati per poi
 * ricomporla renderebbe il formato dipendente dall'ordine.
 *
 * Uno stato nullo significa "non compilato" e cancella la riga: è diverso da
 * "assente", e tenerli distinti è ciò che rende oneste le percentuali.
 */
export const schemaRighePresenza = z
  .array(
    z.object({
      tesseramentoId: z.uuid(),
      stato: z
        .enum(['presente', 'assente', 'giustificato', 'infortunato'])
        .nullable(),
    }),
  )
  .min(1, 'Nessuna riga da salvare')

export function campiSeduta(form: FormData): Record<string, unknown> {
  return {
    data: form.get('data'),
    oraInizio: form.get('oraInizio'),
    note: form.get('note'),
  }
}
