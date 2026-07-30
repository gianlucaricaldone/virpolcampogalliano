'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import { creaSeduta, rimuoviSeduta, salvaPresenze } from '@/lib/repos/presenze'
import { supabaseServer } from '@/lib/supabase/server'
import { campiSeduta, schemaRighePresenza, schemaSeduta } from '@/lib/validation/presenza'

// L'allenatore è incluso: è il solo posto in cui scrive. Quali sedute e quali
// giocatori può toccare lo decidono le policy, non questo elenco.
const SCRITTURA = ['admin', 'dirigente', 'allenatore'] as const

export async function creaSedutaAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaSeduta.safeParse(campiSeduta(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('presenze.creaSeduta', async () => {
    const db = await supabaseServer()
    const sessione = await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    return (
      await creaSeduta(db, {
        ...campi.data,
        squadraId,
        stagioneId: stagione.id,
        creataDa: sessione.userId,
      })
    ).id
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/presenze/${squadraId}`)
  redirect(`/${codice}/presenze/${squadraId}/${esito.dati}`)
}

export async function rimuoviSedutaAzione(
  codice: string,
  squadraId: string,
  sedutaId: string,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('presenze.rimuoviSeduta', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await rimuoviSeduta(db, sedutaId)
    return null
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/presenze/${squadraId}`)
  redirect(`/${codice}/presenze/${squadraId}`)
}

export async function salvaPresenzeAzione(
  codice: string,
  squadraId: string,
  sedutaId: string,
  righe: unknown,
): Promise<Risultato<null>> {
  const campi = schemaRighePresenza.safeParse(righe)
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('presenze.salva', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await salvaPresenze(db, sedutaId, campi.data)
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/presenze/${squadraId}/${sedutaId}`)
    revalidatePath(`/${codice}/presenze/${squadraId}`)
    revalidatePath(`/${codice}/statistiche`)
  }
  return esito
}
