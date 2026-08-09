import { ErroreDominio } from '@/lib/azioni'
import { chiHaLaMaglia } from '@/lib/repos/tesseramenti'
import type { Db } from '@/lib/supabase/server'

/**
 * Sta qui e non in una delle due `actions.ts` che lo usano perché un file
 * `'use server'` può esportare solo funzioni asincrone, e ognuna diventa un
 * endpoint: esportare questo helper da lì significherebbe pubblicarlo.
 */
function eMagliaOccupata(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null &&
    (e as { code?: string }).code === '23505' &&
    String((e as { message?: string }).message).includes('tesseramenti_squadra_maglia_uidx')
  )
}

/**
 * "Il numero 10 è già assegnato" costringe a cercare a mano chi ce l'ha, e chi
 * lo cerca a mano lo cerca ogni volta. La query in più vale il messaggio.
 */
export async function conMagliaParlante<T>(
  db: Db,
  squadraId: string | null,
  numero: number | null,
  corpo: () => Promise<T>,
): Promise<T> {
  try {
    return await corpo()
  } catch (e) {
    if (eMagliaOccupata(e) && squadraId && numero !== null) {
      const chi = await chiHaLaMaglia(db, squadraId, numero)
      if (chi) throw new ErroreDominio(`Il numero ${numero} è già di ${chi}`)
    }
    throw e
  }
}
