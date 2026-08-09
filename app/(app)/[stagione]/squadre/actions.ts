'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { daErroreZod, eseguiAzione, type Risultato } from '@/lib/azioni'
import { stagioneModificabile } from '@/lib/azioni-stagione'
import { richiediRuolo } from '@/lib/auth/session'
import { creaIncarico, elencaIncarichi, rimuoviIncarico } from '@/lib/repos/incarichi'
import { creaPersona, elencaPersone, eliminaPersona, type Persona } from '@/lib/repos/persone'
import { aggiornaSquadra, creaSquadra, eliminaSquadra } from '@/lib/repos/squadre'
import { creaTesseramento, elencaTesseramenti } from '@/lib/repos/tesseramenti'
import { supabaseServer } from '@/lib/supabase/server'
import { campiSquadra, schemaSquadra } from '@/lib/validation/squadra'
import {
  campiNuovoGiocatore,
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
 *
 * Nessun numero di maglia da qui: non si chiede più nel form, quindi non c'è
 * l'indice unico per squadra da far scattare e non serve `conMagliaParlante`.
 * La maglia si imposta dalla scheda del tesserato, dove quel messaggio vive.
 */
export async function tesseraNellaSquadraAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaTesseraInSquadra.safeParse({ personaId: form.get('personaId') })
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('tesseramenti.creaInSquadra', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)
    await creaTesseramento(db, {
      personaId: campi.data.personaId, squadraId, stagioneId: stagione.id, numeroMaglia: null,
    })
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
 * La compensazione conta più di quanto sembri: `persone_del` è concessa al solo
 * admin, quindi se il tesseramento fallisse dopo la creazione un dirigente si
 * ritroverebbe in anagrafica un giocatore mai tesserato e nessun modo di
 * togliercelo. Da quando il numero di maglia non si chiede più, il caso è
 * remoto — la persona è appena nata, quindi non può già essere tesserata in
 * questa stagione, che è l'unico altro vincolo — ma la rete resta.
 */
export async function creaGiocatoreNellaSquadraAzione(
  codice: string,
  squadraId: string,
  _precedente: Risultato<null> | null,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schemaNuovoGiocatore.safeParse(campiNuovoGiocatore(form))
  if (!campi.success) return daErroreZod(campi.error)
  const persona = campi.data

  const esito = await eseguiAzione('tesseramenti.creaGiocatore', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    const stagione = await stagioneModificabile(db, codice)

    const creata = await creaPersona(db, {
      ...persona,
      codiceFiscale: null, email: null, telefono: null,
      indirizzo: null, citta: null, cap: null, provincia: null, note: null,
    })

    try {
      await creaTesseramento(db, {
        personaId: creata.id, squadraId, stagioneId: stagione.id, numeroMaglia: null,
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

/**
 * Candidati per gli autocomplete della scheda squadra. Non è una scrittura, ma
 * sta fra le Server Action per la stessa ragione per cui ci stanno le altre: il
 * browser non parla mai direttamente a Supabase per dati di dominio. Passando da
 * qui la query gira col client del server, con la sessione dell'utente, e le RLS
 * decidono cosa può vedere — una chiamata dal client con la chiave anon sarebbe
 * una seconda strada verso l'anagrafica, da sorvegliare a parte.
 *
 * L'esclusione di chi è già dentro si fa qui e non nel componente: se
 * arrivassero al browser anche i già tesserati, l'elenco dell'anagrafica
 * finirebbe comunque nel client, solo con qualche riga barrata.
 */
export async function cercaCandidatiAzione(
  codice: string,
  squadraId: string,
  ambito: 'rosa' | 'staff',
  testo: string,
): Promise<Risultato<Persona[]>> {
  return eseguiAzione('squadre.cercaCandidati', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, [...SCRITTURA])
    // `stagioneModificabile` e non una semplice lettura: i candidati servono a
    // scrivere, e su una stagione chiusa non c'è nulla da proporre.
    const stagione = await stagioneModificabile(db, codice)

    // Due caratteri: con uno solo la prima lettera dell'alfabeto restituisce
    // mezza anagrafica a ogni battuta, e nessuno sceglie da un elenco così.
    const cercato = testo.trim()
    if (cercato.length < 2) return []

    const trovate = await elencaPersone(db, { cognome: cercato, soloAttive: true })
    const esclusi = ambito === 'rosa'
      ? new Set((await elencaTesseramenti(db, stagione.id)).map((t) => t.persona.id))
      : new Set((await elencaIncarichi(db, squadraId)).map((i) => i.persona.id))

    // Dieci righe: oltre, l'elenco a tendina diventa una pagina da scorrere e
    // conviene scrivere una lettera in più.
    return trovate.filter((p) => !esclusi.has(p.id)).slice(0, 10)
  })
}
