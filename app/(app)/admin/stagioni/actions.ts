'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eseguiAzione, type Risultato } from '@/lib/azioni'
import { richiediRuolo } from '@/lib/auth/session'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { cambiaStato, creaStagione } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

const schema = z.object({
  codice: z.string().regex(/^\d{4}-\d{2}$/, 'Forma attesa: 2026-27'),
  dataInizio: z.string().min(1, 'Data di inizio obbligatoria'),
  dataFine: z.string().min(1, 'Data di fine obbligatoria'),
})

export async function creaStagioneAzione(
  _precedente: unknown,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schema.safeParse({
    codice: form.get('codice'),
    dataInizio: form.get('dataInizio'),
    dataFine: form.get('dataFine'),
  })
  if (!campi.success) {
    return {
      ok: false,
      errore: 'Controlla i dati inseriti',
      campi: Object.fromEntries(campi.error.issues.map((i) => [String(i.path[0]), i.message])),
    }
  }

  const esito = await eseguiAzione('stagioni.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])
    await creaStagione(db, {
      codice: campi.data.codice,
      etichetta: etichettaDaCodice(campi.data.codice),
      dataInizio: campi.data.dataInizio,
      dataFine: campi.data.dataFine,
    })
    return null
  })

  if (esito.ok) revalidatePath('/admin/stagioni')
  return esito
}

export async function cambiaStatoAzione(
  id: string,
  stato: 'aperta' | 'chiusa',
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('stagioni.cambiaStato', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])
    await cambiaStato(db, id, stato)
    return null
  })
  if (esito.ok) revalidatePath('/admin/stagioni')
  return esito
}
