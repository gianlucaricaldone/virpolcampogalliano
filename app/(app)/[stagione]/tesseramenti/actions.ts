'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { conMagliaParlante } from '@/lib/azioni-maglia'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import {
  aggiornaAssegnazione,
  creaTesseramento,
  rimuoviTesseramento,
} from '@/lib/repos/tesseramenti'
import { impostaVisita } from '@/lib/repos/visite'
import { supabaseServer } from '@/lib/supabase/server'
import {
  campiTesseramento,
  schemaAssegnazione,
  schemaTesseramento,
  schemaVisita,
} from '@/lib/validation/tesseramento'

const SCRITTURA = ['admin', 'dirigente'] as const

export async function creaTesseramentoAzione(
  codice: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaTesseramento.safeParse(campiTesseramento(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('tesseramenti.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    const creato = await conMagliaParlante(db, campi.data.squadraId, campi.data.numeroMaglia, () =>
      creaTesseramento(db, { ...campi.data, stagioneId: stagione.id }),
    )
    return creato.id
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/tesseramenti`)
  redirect(`/${codice}/tesseramenti/${esito.dati}`)
}

export async function aggiornaAssegnazioneAzione(
  codice: string,
  id: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaAssegnazione.safeParse(campiTesseramento(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('tesseramenti.assegna', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await conMagliaParlante(db, campi.data.squadraId, campi.data.numeroMaglia, () =>
      aggiornaAssegnazione(db, id, campi.data),
    )
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/tesseramenti`)
    revalidatePath(`/${codice}/tesseramenti/${id}`)
  }
  return esito
}

export async function impostaVisitaAzione(
  codice: string,
  id: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaVisita.safeParse({
    scadenza: form.get('scadenza'),
    consegnataIl: form.get('consegnataIl'),
  })
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('tesseramenti.visita', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await impostaVisita(db, id, campi.data)
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/tesseramenti/${id}`)
    revalidatePath(`/${codice}`)
  }
  return esito
}

export async function rimuoviTesseramentoAzione(
  codice: string,
  id: string,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('tesseramenti.rimuovi', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await rimuoviTesseramento(db, id)
    return null
  })
  if (!esito.ok) return esito

  revalidatePath(`/${codice}/tesseramenti`)
  redirect(`/${codice}/tesseramenti`)
}
