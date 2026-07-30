import { cache } from 'react'
import { getSessione, type Sessione } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * La sessione della richiesta in corso, letta una volta sola.
 *
 * Senza, `getSessione` girava nel layout del backoffice **e** in ogni pagina:
 * due chiamate ad `auth.getUser()`, che non è una lettura locale del token ma
 * una richiesta al server Auth, più due select su `profili`. Quattro round
 * trip per rendere una pagina, e a ogni pagina.
 *
 * `React.cache` è la forma di deduplicazione ammessa: è legata alla singola
 * richiesta e non ha TTL. **Non** è la cache di autenticazione vietata — quella
 * teneva un ruolo revocato utilizzabile per cinque minuti. Qui, alla richiesta
 * successiva si torna a interrogare Auth e `profili`, quindi un profilo
 * disattivato smette di funzionare al primo caricamento successivo.
 *
 * Sta in un modulo suo e non in `lib/auth/session.ts` perché importa
 * `next/headers`: quel modulo deve restare caricabile dai test, che il client
 * glielo passano da fuori.
 */
export const sessioneCorrente = cache(async (): Promise<Sessione | null> => {
  return getSessione(await supabaseServer())
})
