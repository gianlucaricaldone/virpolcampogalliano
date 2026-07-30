'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import { creaIncarico, rimuoviIncarico } from '@/lib/repos/incarichi'
import { aggiornaSquadra, creaSquadra, eliminaSquadra } from '@/lib/repos/squadre'
import { supabaseServer } from '@/lib/supabase/server'
import { campiSquadra, schemaSquadra } from '@/lib/validation/squadra'
import { schemaIncarico } from '@/lib/validation/tesseramento'

const SCRITTURA = ['admin', 'dirigente'] as const

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

export async function creaIncaricoAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaIncarico.safeParse({
    personaId: form.get('personaId'),
    ruolo: form.get('ruolo'),
  })
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('incarichi.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    await creaIncarico(db, { ...campi.data, stagioneId: stagione.id, squadraId })
    return null
  })

  if (esito.ok) revalidatePath(`/${codice}/squadre/${squadraId}`)
  return esito
}

export async function rimuoviIncaricoAzione(
  codice: string,
  squadraId: string,
  id: string,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('incarichi.rimuovi', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await rimuoviIncarico(db, id)
    return null
  })

  if (esito.ok) revalidatePath(`/${codice}/squadre/${squadraId}`)
  return esito
}
