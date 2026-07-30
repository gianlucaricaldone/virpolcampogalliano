import type { ZodError } from 'zod'
import { ErroreAutorizzazione } from '@/lib/auth/session'
import { traduciErrorePostgres } from '@/lib/errors/postgres'
import { log } from '@/lib/log'

export type Risultato<T> =
  | { ok: true; dati: T }
  | { ok: false; errore: string; campi?: Record<string, string> }

/**
 * Fallimento previsto con un messaggio già scritto per l'utente: stagione
 * chiusa, numero di maglia occupato da un giocatore che sappiamo nominare.
 * Non è un bug e non è un errore di autorizzazione — distinguerlo serve a non
 * far somigliare un vincolo di dominio a un problema di permessi.
 */
export class ErroreDominio extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = 'ErroreDominio'
  }
}

/**
 * Errori di validazione zod nella forma che i form si aspettano: un messaggio
 * per campo, sulla chiave del campo. Solo il primo problema per campo — è
 * quello che l'utente correggerà comunque per primo.
 */
export function daErroreZod(errore: ZodError): Risultato<never> {
  const campi: Record<string, string> = {}
  for (const problema of errore.issues) {
    const campo = String(problema.path[0])
    campi[campo] ??= problema.message
  }
  return { ok: false, errore: 'Controlla i dati inseriti', campi }
}

/**
 * Racchiude il corpo di una Server Action e trasforma i fallimenti previsti
 * in un Risultato. I bug veri continuano a propagare verso error.tsx: un bug
 * non deve somigliare a un errore di validazione.
 */
export async function eseguiAzione<T>(
  nome: string,
  corpo: () => Promise<T>,
): Promise<Risultato<T>> {
  try {
    return { ok: true, dati: await corpo() }
  } catch (e) {
    if (e instanceof ErroreAutorizzazione) {
      log.warn(`${nome}.negata`, { motivo: e.message })
      return { ok: false, errore: e.message }
    }
    if (e instanceof ErroreDominio) {
      log.warn(`${nome}.rifiutata`, { motivo: e.message })
      return { ok: false, errore: e.message }
    }
    if (e instanceof Error && e.name === 'CredenzialiNonValide') {
      log.warn(`${nome}.credenziali`)
      return { ok: false, errore: e.message }
    }
    const tradotto = traduciErrorePostgres(e)
    if (tradotto) {
      log.warn(`${nome}.rifiutata`, { codice: (e as { code: string }).code })
      return { ok: false, errore: tradotto }
    }
    throw e
  }
}
