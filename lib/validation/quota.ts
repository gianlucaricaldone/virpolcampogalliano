import { z } from 'zod'
import { numeroDaTesto } from '@/lib/domain/denaro'
import { facoltativo } from '@/lib/validation/comune'

/**
 * Importo digitato a mano: si accetta la virgola decimale e il punto delle
 * migliaia, perché è così che si scrive un importo in italiano. Se il testo
 * non è un numero resta tale e lo schema lo rifiuta con il proprio messaggio,
 * invece di trasformarsi in NaN e finire nel database.
 */
function importo(minimo: number, messaggio: string) {
  return z.preprocess(
    (v) => (typeof v === 'string' ? (numeroDaTesto(v) ?? v) : v),
    z.number({ message: messaggio }).min(minimo, messaggio),
  )
}

export const schemaImporto = z.object({
  importo: importo(0, 'Inserisci un importo valido, per esempio 250,00'),
})

export const schemaPagamento = z.object({
  // Il minimo è il centesimo e non lo zero: pagamenti_importo_positivo
  // rifiuterebbe comunque uno zero, ma con un messaggio meno chiaro.
  importo: importo(0.01, 'Il versamento deve essere maggiore di zero'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La data del versamento è obbligatoria'),
  metodo: z.enum(['contanti', 'bonifico', 'altro'], { message: 'Metodo non valido' }),
  note: facoltativo(z.string()),
})

/** Esattamente un livello, come impone quote_importi_un_solo_livello. */
export const schemaLivello = z
  .object({
    stagioneId: z.uuid().optional(),
    squadraId: z.uuid().optional(),
    tesseramentoId: z.uuid().optional(),
  })
  .refine(
    (l) => [l.stagioneId, l.squadraId, l.tesseramentoId].filter(Boolean).length === 1,
    'Un importo si riferisce a un solo livello',
  )

export const METODI = [
  { valore: 'contanti', etichetta: 'Contanti' },
  { valore: 'bonifico', etichetta: 'Bonifico' },
  { valore: 'altro', etichetta: 'Altro' },
] as const
