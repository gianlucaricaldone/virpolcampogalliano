import { z } from 'zod'
import { TAGLIE } from '@/lib/domain/materiale'
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
 *
 * Niente numero di maglia: la società non lo usa, e dalla scheda squadra non si
 * chiede. La colonna resta — c'è chi l'ha compilata in passato e l'indice unico
 * per squadra la protegge — e si imposta dalla scheda del tesserato, dove serve
 * anche per spostarlo.
 */
export const schemaTesseraInSquadra = schemaTesseramento.pick({ personaId: true })

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
export const schemaNuovoGiocatore = schemaPersona.pick({
  nome: true,
  cognome: true,
  dataNascita: true,
})

export function campiNuovoGiocatore(form: FormData): Record<string, unknown> {
  return {
    nome: form.get('nome'),
    cognome: form.get('cognome'),
    dataNascita: form.get('dataNascita'),
  }
}

/**
 * Le due date della visita. Entrambe facoltative: svuotare la scadenza è il
 * modo di dire "questa visita non c'è più", e va ammesso.
 */
export const schemaVisita = z.object({
  scadenza: facoltativo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')),
  consegnataIl: facoltativo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')),
  // Due radio e non una checkbox: una casella non spuntata non distingue "no"
  // da "non ho ancora guardato", e qui la differenza è il motivo per cui la
  // colonna esiste. `sì`/`no` come stringhe perché è quello che un form manda.
  consegnata: z.enum(['si', 'no'], { message: 'Indica se è stata consegnata' })
    .transform((v) => v === 'si'),
})

/**
 * Materiale sportivo: la consegna e la taglia, senza legami fra le due.
 *
 * A differenza della visita qui non c'è nessuna combinazione da vietare: la
 * taglia si raccoglie prima di ordinare la fornitura, quindi «taglia M, non
 * consegnato» è lo stato in cui sta metà squadra per mezza stagione. Vedi il
 * commento della migration 20260810000200.
 */
export const schemaMateriale = z.object({
  consegnato: z.enum(['si', 'no'], { message: 'Indica se è stato consegnato' })
    .transform((v) => v === 'si'),
  // `facoltativo` con `maiuscolo`: la scala è in maiuscolo e un 'm' che arrivi
  // da un client diverso dal nostro menù è la stessa taglia, non una nuova.
  taglia: facoltativo(z.enum(TAGLIE, { message: 'Taglia non prevista' }), true),
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
