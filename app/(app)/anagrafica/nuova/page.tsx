import { redirect } from 'next/navigation'
import { FormPersona } from '@/components/persone/FormPersona'
import { getSessione } from '@/lib/auth/session'
import { supabaseServer } from '@/lib/supabase/server'
import { creaPersonaAzione } from '../actions'

export default async function PaginaNuovaPersona() {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  // Le policy persone_ins negherebbero comunque l'inserimento: qui si evita
  // solo di mostrare un form che non può funzionare.
  if (sessione?.ruolo !== 'admin' && sessione?.ruolo !== 'dirigente') redirect('/anagrafica')

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Nuova persona</h1>
      <FormPersona azione={creaPersonaAzione} etichettaInvio="Crea persona" />
    </section>
  )
}
