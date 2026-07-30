import { ErroreDominio } from '@/lib/azioni'
import { stagionePerCodice, type Stagione } from '@/lib/repos/stagioni'
import type { Db } from '@/lib/supabase/server'

/**
 * Risolve il codice di stagione dell'URL e pretende che sia aperta.
 *
 * La stagione non arriva mai come id da un campo nascosto: le policy la
 * riverificano comunque — `app.stagione_aperta` è dentro ogni `with check` —
 * ma un id manomesso darebbe un 42501 opaco invece di un messaggio, e su
 * stagione chiusa l'utente leggerebbe "operazione non consentita" senza sapere
 * perché.
 */
export async function stagioneModificabile(db: Db, codice: string): Promise<Stagione> {
  const stagione = await stagionePerCodice(db, codice)
  if (!stagione) throw new ErroreDominio('Stagione inesistente')
  if (stagione.stato === 'chiusa') {
    throw new ErroreDominio('La stagione è chiusa: i dati sono in sola lettura')
  }
  return stagione
}
