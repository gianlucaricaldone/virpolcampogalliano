'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, ErroreDominio, eseguiAzione, type Risultato } from '@/lib/azioni'
import { conMagliaParlante } from '@/lib/azioni-maglia'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import { creaIncarico, rimuoviIncarico } from '@/lib/repos/incarichi'
import { creaPersona, eliminaPersona } from '@/lib/repos/persone'
import { aggiornaSquadra, creaSquadra, eliminaSquadra } from '@/lib/repos/squadre'
import { chiHaLaMaglia, creaTesseramento } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { campiSquadra, schemaSquadra } from '@/lib/validation/squadra'
import {
  campiNuovoGiocatore,
  campiTesseramento,
  schemaIncarico,
  schemaNuovoGiocatore,
  schemaTesseraInSquadra,
} from '@/lib/validation/tesseramento'

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

/**
 * Tessera una persona direttamente nella squadra che si sta guardando. La
 * squadra arriva dall'URL e non dal form: `schemaTesseraInSquadra` non ha un
 * campo `squadraId` da leggere, quindi non esiste un modo per tesserare
 * altrove passando dalla scheda di questa squadra.
 *
 * Nessun redirect, al contrario di creaTesseramentoAzione: chi sta componendo
 * una rosa ne aggiunge dieci di fila, e finire ogni volta sulla scheda del
 * tesserato appena creato costringerebbe a tornare indietro dieci volte.
 */
export async function tesseraNellaSquadraAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaTesseraInSquadra.safeParse(campiTesseramento(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('tesseramenti.creaInSquadra', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    await conMagliaParlante(db, squadraId, campi.data.numeroMaglia, () =>
      creaTesseramento(db, { ...campi.data, squadraId, stagioneId: stagione.id }),
    )
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/squadre/${squadraId}`)
    // L'elenco generale conta i tesserati della stagione: senza questa riga
    // resterebbe con il numero di prima finché non scade la cache.
    revalidatePath(`/${codice}/tesseramenti`)
  }
  return esito
}

/**
 * Crea una persona nuova e la tessera nella squadra in un colpo: chi compone
 * una rosa a inizio stagione ha in mano un elenco di nomi che in anagrafica non
 * ci sono ancora, e mandarlo su /anagrafica/nuova e poi indietro per ognuno
 * significa due pagine per giocatore.
 *
 * Il tesseramento è la ragione del gesto, non un effetto collaterale: la
 * persona da sola non comparirebbe in nessuna rosa.
 *
 * Il numero di maglia si verifica PRIMA di creare la persona. Non è
 * un'ottimizzazione: è l'unico fallimento probabile di questa sequenza, e
 * arrivando dopo la creazione lascerebbe una persona da cancellare — cosa che
 * `persone_del` concede al solo admin, quindi un dirigente si ritroverebbe in
 * anagrafica un giocatore mai tesserato e nessun modo di togliercelo.
 */
export async function creaGiocatoreNellaSquadraAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaNuovoGiocatore.safeParse(campiNuovoGiocatore(form))
  if (!campi.success) return daErroreZod(campi.error)
  const { numeroMaglia, ...persona } = campi.data

  const esito = await eseguiAzione('tesseramenti.creaGiocatore', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)

    if (numeroMaglia !== null) {
      const chi = await chiHaLaMaglia(db, squadraId, numeroMaglia)
      if (chi) throw new ErroreDominio(`Il numero ${numeroMaglia} è già di ${chi}`)
    }

    const creata = await creaPersona(db, {
      ...persona,
      codiceFiscale: null, email: null, telefono: null,
      indirizzo: null, citta: null, cap: null, provincia: null, note: null,
    })

    try {
      await creaTesseramento(db, {
        personaId: creata.id, squadraId, stagioneId: stagione.id, numeroMaglia,
      })
    } catch (e) {
      // Compensazione, con la stessa regola di utenti.crea: se anche la
      // compensazione fallisce l'errore utile è quello originale, e l'orfano
      // si registra nei log invece di sparire dietro un secondo errore.
      try {
        await eliminaPersona(db, creata.id)
      } catch (erroreCompensazione) {
        console.error(
          `tesseramenti.creaGiocatore: compensazione fallita, persona senza tesseramento id=${creata.id}`,
          erroreCompensazione,
        )
      }
      throw e
    }
    return null
  })

  if (esito.ok) {
    revalidatePath(`/${codice}/squadre/${squadraId}`)
    revalidatePath(`/${codice}/tesseramenti`)
    revalidatePath('/anagrafica')
  }
  return esito
}
