'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { ErroreAutorizzazione, richiediRuolo } from '@/lib/auth/session'
import { aggiornaSquadra, creaSquadra, eliminaSquadra } from '@/lib/repos/squadre'
import { stagionePerCodice } from '@/lib/repos/stagioni'
import { supabaseServer, type Db } from '@/lib/supabase/server'
import { campiSquadra, schemaSquadra } from '@/lib/validation/squadra'

const SCRITTURA = ['admin', 'dirigente'] as const

/**
 * La stagione arriva dal codice nell'URL e viene risolta qui, mai passata come
 * id in un campo nascosto: le policy la riverificano comunque, ma un id
 * arbitrario darebbe un 42501 opaco al posto di un messaggio.
 */
async function stagioneModificabile(db: Db, codice: string) {
  const stagione = await stagionePerCodice(db, codice)
  if (!stagione) throw new ErroreAutorizzazione('Stagione inesistente')
  if (stagione.stato === 'chiusa') {
    throw new ErroreAutorizzazione('La stagione è chiusa: i dati sono in sola lettura')
  }
  return stagione
}

export async function creaSquadraAzione(
  codice: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaSquadra.safeParse(campiSquadra(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('squadre.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    return (await creaSquadra(db, { ...campi.data, stagioneId: stagione.id })).id
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/squadre`)
  redirect(`/${codice}/squadre/${esito.dati}`)
}

export async function aggiornaSquadraAzione(
  codice: string,
  id: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaSquadra.safeParse(campiSquadra(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('squadre.aggiorna', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await aggiornaSquadra(db, id, campi.data)
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/squadre`)
    revalidatePath(`/${codice}/squadre/${id}`)
  }
  return esito
}

export async function eliminaSquadraAzione(
  codice: string,
  id: string,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('squadre.elimina', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await eliminaSquadra(db, id)
    return null
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/squadre`)
  redirect(`/${codice}/squadre`)
}
