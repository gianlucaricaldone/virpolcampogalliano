import { z } from 'zod'
import { facoltativo, facoltativoIntero } from '@/lib/validation/comune'
import { schemaPersona } from '@/lib/validation/persona'

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

/**
 * Tesseramento fatto dalla scheda di una squadra: la squadra viene dall'URL,
 * non dal form. Un `squadraId` inviato dal browser sarebbe un modo per
 * tesserare in una squadra diversa da quella che si sta guardando.
 */
export const schemaTesseraInSquadra = schemaTesseramento.omit({ squadraId: true })

/**
 * Giocatore nuovo creato dalla scheda squadra: la persona non esiste ancora in
 * anagrafica, quindi qui arrivano insieme i suoi dati minimi e il tesseramento.
 *
 * I campi della persona si prendono da `schemaPersona` invece di riscriverli:
 * se lì cambia un vincolo — è già successo con `dataNascita`, diventata
 * facoltativa — cambia anche qui, e i due percorsi di creazione non possono
 * divergere sulle regole della stessa entità. Il resto dell'anagrafica
 * (codice fiscale, indirizzo, contatti) si completa dalla scheda della persona:
 * un modulo di dodici campi dentro la scheda squadra non lo compila nessuno a
 * bordo campo.
 */
export const schemaNuovoGiocatore = schemaPersona
  .pick({ nome: true, cognome: true, dataNascita: true })
  .extend({ numeroMaglia: schemaTesseramento.shape.numeroMaglia })

export function campiNuovoGiocatore(form: FormData): Record<string, unknown> {
  return {
    nome: form.get('nome'),
    cognome: form.get('cognome'),
    dataNascita: form.get('dataNascita'),
    numeroMaglia: form.get('numeroMaglia'),
  }
}

/**
 * Le due date della visita. Entrambe facoltative: svuotare la scadenza è il
 * modo di dire "questa visita non c'è più", e va ammesso.
 */
export const schemaVisita = z.object({
  scadenza: facoltativo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')),
  consegnataIl: facoltativo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')),
})

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
