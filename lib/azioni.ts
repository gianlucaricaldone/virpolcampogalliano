import { ErroreAutorizzazione } from '@/lib/auth/session'
import { traduciErrorePostgres } from '@/lib/errors/postgres'
import { log } from '@/lib/log'

export type Risultato<T> =
  | { ok: true; dati: T }
  | { ok: false; errore: string; campi?: Record<string, string> }

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
