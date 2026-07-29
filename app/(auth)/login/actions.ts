'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { eseguiAzione, type Risultato } from '@/lib/azioni'
import { supabaseServer } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email('Indirizzo email non valido'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export async function accedi(_precedente: unknown, form: FormData): Promise<Risultato<null>> {
  const campi = schema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!campi.success) {
    return {
      ok: false,
      errore: 'Controlla i dati inseriti',
      campi: Object.fromEntries(
        campi.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    }
  }

  const esito = await eseguiAzione('accesso', async () => {
    const db = await supabaseServer()
    const { error } = await db.auth.signInWithPassword(campi.data)
    // Solo le credenziali sbagliate diventano un messaggio per l'utente. Un
    // rate limit, un progetto malconfigurato o un'interruzione del servizio
    // Auth sono bug: devono arrivare a error.tsx col loro errore originale,
    // non travestiti da password errata.
    if (error?.code === 'invalid_credentials') throw new CredenzialiNonValide()
    if (error) throw error
    return null
  })

  if (!esito.ok) return esito
  redirect('/gestione')
}

class CredenzialiNonValide extends Error {
  constructor() {
    super('Email o password non corretti')
    this.name = 'CredenzialiNonValide'
  }
}
