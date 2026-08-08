'use server'

import { revalidatePath } from 'next/cache'
import { daErroreZod, ErroreDominio, eseguiAzione, type Risultato } from '@/lib/azioni'
import { richiediRuolo, type RuoloApp } from '@/lib/auth/session'
import { passwordIniziale } from '@/lib/domain/password'
import { personaPerId } from '@/lib/repos/persone'
import { aggiornaProfilo, creaProfilo, elencaUtenti } from '@/lib/repos/utenti'
import { supabaseServizio } from '@/lib/supabase/servizio'
import { supabaseServer } from '@/lib/supabase/server'
import { campiNuovoUtente, schemaNuovoUtente } from '@/lib/validation/utente'

function eEmailGiaUsata(messaggio: string): boolean {
  // Auth non espone un codice per questo caso: resta il messaggio.
  return /already been registered|already exists|duplicate/i.test(messaggio)
}

export async function creaUtenteAzione(
  _precedente: Risultato<{ email: string; password: string }> | null,
  form: FormData,
): Promise<Risultato<{ email: string; password: string }>> {
  const campi = schemaNuovoUtente.safeParse(campiNuovoUtente(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('utenti.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])

    const persona = campi.data.personaId ? await personaPerId(db, campi.data.personaId) : null
    if (campi.data.personaId && !persona) {
      throw new ErroreDominio('La persona scelta non esiste più: ricarica la pagina')
    }
    const password = passwordIniziale(persona?.nome ?? campi.data.email.split('@')[0])

    const servizio = supabaseServizio()
    const { data: creato, error } = await servizio.auth.admin.createUser({
      email: campi.data.email,
      password,
      // Senza SMTP nessuno riceverà mai una mail di conferma, e senza questo
      // flag l'utente non potrebbe accedere.
      email_confirm: true,
    })
    if (error) {
      if (eEmailGiaUsata(error.message)) {
        throw new ErroreDominio('Esiste già un utente con questa email')
      }
      throw error
    }

    try {
      await creaProfilo(db, {
        id: creato.user.id,
        ruolo: campi.data.ruolo,
        personaId: campi.data.personaId,
      })
    } catch (e) {
      // Compensazione. Un profilo rifiutato lascerebbe in auth.users un utente
      // che non può entrare ma tiene occupata l'email: il secondo tentativo
      // fallirebbe con "email già registrata" e nessuno capirebbe perché.
      await servizio.auth.admin.deleteUser(creato.user.id)
      throw e
    }

    return { email: campi.data.email, password }
  })

  if (esito.ok) revalidatePath('/admin/utenti')
  return esito
}

export async function aggiornaUtenteAzione(
  id: string,
  dati: { ruolo?: RuoloApp; attivo?: boolean },
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('utenti.aggiorna', async () => {
    const db = await supabaseServer()
    const sessione = await richiediRuolo(db, ['admin'])

    // profili_upd guarda il ruolo di chi scrive, non chi subisce: le policy
    // lascerebbero passare. In una società con un solo amministratore questo
    // click chiuderebbe fuori tutti, senza più nessuno in grado di riaprire.
    if (id === sessione.userId && (dati.attivo === false || (dati.ruolo && dati.ruolo !== 'admin'))) {
      throw new ErroreDominio('Non puoi disattivare o declassare il tuo stesso account')
    }

    await aggiornaProfilo(db, id, dati)
    return null
  })

  if (esito.ok) revalidatePath('/admin/utenti')
  return esito
}

export async function reimpostaPasswordAzione(id: string): Promise<Risultato<{ password: string }>> {
  return eseguiAzione('utenti.password', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])

    // Si rilegge dall'elenco invece di aggiungere una funzione SQL per un solo
    // utente: sono una manciata di righe, e la funzione esiste già.
    const utente = (await elencaUtenti(db)).find((u) => u.id === id)
    if (!utente) throw new ErroreDominio('Utente non trovato')

    const password = passwordIniziale(utente.persona?.nome ?? utente.email.split('@')[0])
    const { error } = await supabaseServizio().auth.admin.updateUserById(id, { password })
    if (error) throw error
    return { password }
  })
}
