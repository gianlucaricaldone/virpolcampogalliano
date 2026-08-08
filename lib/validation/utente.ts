import { z } from 'zod'
import { facoltativo } from '@/lib/validation/comune'

/**
 * Il vincolo profili_allenatore_ha_persona rifiuterebbe comunque un allenatore
 * senza persona, ma con un messaggio che parla di un vincolo del database.
 * Qui si dice all'utente cosa manca.
 */
export const schemaNuovoUtente = z
  .object({
    email: z.email('Indirizzo email non valido'),
    ruolo: z.enum(['admin', 'dirigente', 'allenatore'], { message: 'Scegli un ruolo' }),
    personaId: facoltativo(z.uuid('Persona non valida')),
  })
  .refine((d) => d.ruolo !== 'allenatore' || d.personaId !== null, {
    message: 'Un allenatore va collegato a una persona in anagrafica',
    path: ['personaId'],
  })

export function campiNuovoUtente(form: FormData): Record<string, unknown> {
  return {
    email: form.get('email'),
    ruolo: form.get('ruolo'),
    personaId: form.get('personaId'),
  }
}
