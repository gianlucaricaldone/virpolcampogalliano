'use server'

import { revalidatePath } from 'next/cache'
import { daErroreZod, ErroreDominio, eseguiAzione, type Risultato } from '@/lib/azioni'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import {
  annullaPagamento,
  impostaImporto,
  registraPagamento,
  rimuoviImporto,
  type Livello,
} from '@/lib/repos/quote'
import { supabaseServer } from '@/lib/supabase/server'
import { schemaImporto, schemaLivello, schemaPagamento } from '@/lib/validation/quota'

// Le due tabelle finanziarie non hanno policy per l'allenatore: qui il
// controllo serve a dare un messaggio invece di un 42501.
const SCRITTURA = ['admin', 'dirigente'] as const

function livelloValidato(livello: Livello): Livello {
  const esito = schemaLivello.safeParse(livello)
  if (!esito.success) throw new ErroreDominio('Livello dell\'importo non valido')
  return livello
}

function percorsi(codice: string, livello: Livello): string[] {
  const base = [`/${codice}/quote`, `/${codice}`]
  return livello.tesseramentoId
    ? [...base, `/${codice}/tesseramenti/${livello.tesseramentoId}`]
    : base
}

export async function impostaImportoAzione(
  codice: string,
  livello: Livello,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaImporto.safeParse({ importo: form.get('importo') })
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('quote.importo', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await impostaImporto(db, livelloValidato(livello), campi.data.importo)
    return null
  })

  if (esito.ok) for (const p of percorsi(codice, livello)) revalidatePath(p)
  return esito
}

export async function rimuoviImportoAzione(
  codice: string,
  livello: Livello,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('quote.importo.rimuovi', async () => {
    const db = await supabaseServer()
    // quote_del è riservata all'admin: il dirigente configura, non cancella.
    await richiediRuolo(db, ['admin'])
    await stagioneModificabile(db, codice)
    await rimuoviImporto(db, livelloValidato(livello))
    return null
  })

  if (esito.ok) for (const p of percorsi(codice, livello)) revalidatePath(p)
  return esito
}

export async function registraPagamentoAzione(
  codice: string,
  tesseramentoId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaPagamento.safeParse({
    importo: form.get('importo'),
    data: form.get('data'),
    metodo: form.get('metodo'),
    note: form.get('note'),
  })
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('quote.pagamento', async () => {
    const db = await supabaseServer()
    const sessione = await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await registraPagamento(db, {
      tesseramentoId,
      ...campi.data,
      registratoDa: sessione.userId,
    })
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/quote`)
    revalidatePath(`/${codice}/tesseramenti/${tesseramentoId}`)
    revalidatePath(`/${codice}`)
  }
  return esito
}

export async function annullaPagamentoAzione(
  codice: string,
  tesseramentoId: string,
  pagamentoId: string,
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('quote.pagamento.annulla', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    await stagioneModificabile(db, codice)
    await annullaPagamento(db, pagamentoId)
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/quote`)
    revalidatePath(`/${codice}/tesseramenti/${tesseramentoId}`)
    revalidatePath(`/${codice}`)
  }
  return esito
}
