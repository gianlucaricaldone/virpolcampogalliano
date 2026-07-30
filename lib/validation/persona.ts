import { z } from 'zod'
import { facoltativo } from '@/lib/validation/comune'

// `codice_fiscale` è la ragione per cui `facoltativo` esiste: la colonna è
// UNIQUE e nullable, e il secondo minore senza codice fiscale — la
// maggioranza dell'anagrafica — collide con il primo se si salva ''.

/**
 * Il codice fiscale si controlla solo nella lunghezza e nell'alfabeto, non con
 * la regex completa del formato: le società giovanili ricevono anche codici
 * provvisori e stranieri, e una validazione troppo stretta si aggira digitando
 * un codice falso — che è peggio di un campo vuoto.
 */
const CODICE_FISCALE = /^[A-Z0-9]{16}$/

export const schemaPersona = z.object({
  nome: z.string().trim().min(1, 'Il nome è obbligatorio'),
  cognome: z.string().trim().min(1, 'Il cognome è obbligatorio'),
  dataNascita: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La data di nascita è obbligatoria'),
  codiceFiscale: facoltativo(
    z.string().regex(CODICE_FISCALE, 'Il codice fiscale ha 16 caratteri'),
    true,
  ),
  email: facoltativo(z.email('Indirizzo email non valido')),
  telefono: facoltativo(z.string()),
  indirizzo: facoltativo(z.string()),
  citta: facoltativo(z.string()),
  cap: facoltativo(z.string().regex(/^\d{5}$/, 'Il CAP è di 5 cifre')),
  provincia: facoltativo(z.string().regex(/^[A-Z]{2}$/, 'La provincia è di 2 lettere'), true),
  note: facoltativo(z.string()),
})

export type DatiPersona = z.infer<typeof schemaPersona>

/** Estrae i campi di una persona da un FormData, senza validarli. */
export function campiPersona(form: FormData): Record<string, unknown> {
  const chiavi = [
    'nome', 'cognome', 'dataNascita', 'codiceFiscale', 'email', 'telefono',
    'indirizzo', 'citta', 'cap', 'provincia', 'note',
  ] as const
  return Object.fromEntries(chiavi.map((c) => [c, form.get(c)]))
}
