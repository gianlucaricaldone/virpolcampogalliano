import { z } from 'zod'
import { facoltativo, facoltativoIntero } from '@/lib/validation/comune'

/**
 * `squadraId` facoltativo non è una svista: un tesserato senza squadra è lo
 * stato normale fra l'iscrizione e la formazione delle rose.
 */
export const schemaTesseramento = z.object({
  personaId: z.uuid('Scegli una persona dall\'anagrafica'),
  squadraId: facoltativo(z.uuid('Squadra non valida')),
  numeroMaglia: facoltativoIntero(
    z.number().int('Il numero di maglia è un intero')
      .min(1, 'Il numero di maglia va da 1 a 99')
      .max(99, 'Il numero di maglia va da 1 a 99'),
  ),
})

/** Solo i campi modificabili dalla scheda: la persona e la stagione non cambiano. */
export const schemaAssegnazione = schemaTesseramento.omit({ personaId: true })

export const schemaIncarico = z.object({
  personaId: z.uuid('Scegli una persona dall\'anagrafica'),
  ruolo: z.enum(['allenatore', 'vice_allenatore', 'dirigente_squadra'], {
    message: 'Scegli un ruolo',
  }),
})

export function campiTesseramento(form: FormData): Record<string, unknown> {
  return {
    personaId: form.get('personaId'),
    squadraId: form.get('squadraId'),
    numeroMaglia: form.get('numeroMaglia'),
  }
}
