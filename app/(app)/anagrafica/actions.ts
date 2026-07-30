'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { richiediRuolo } from '@/lib/auth/session'
import {
  aggiornaPersona,
  archiviaPersona,
  creaPersona,
  riattivaPersona,
} from '@/lib/repos/persone'
import { supabaseServer } from '@/lib/supabase/server'
import { campiPersona, schemaPersona } from '@/lib/validation/persona'

const SCRITTURA = ['admin', 'dirigente'] as const

export async function creaPersonaAzione(
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaPersona.safeParse(campiPersona(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('persone.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    return (await creaPersona(db, campi.data)).id
  })
  if (!esito.ok) return esito

  revalidatePath('/anagrafica')
  redirect(`/anagrafica/${esito.dati}`)
}

export async function aggiornaPersonaAzione(
  id: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaPersona.safeParse(campiPersona(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('persone.aggiorna', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await aggiornaPersona(db, id, campi.data)
    return null
  })

  if (esito.ok) {
    revalidatePath('/anagrafica')
    revalidatePath(`/anagrafica/${id}`)
  }
  return esito
}

export async function cambiaArchiviazioneAzione(
  id: string,
  archivia: boolean,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('persone.archiviazione', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    if (archivia) await archiviaPersona(db, id)
    else await riattivaPersona(db, id)
    return null
  })

  if (esito.ok) {
    revalidatePath('/anagrafica')
    revalidatePath(`/anagrafica/${id}`)
  }
  return esito
}
