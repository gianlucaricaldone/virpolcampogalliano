import { redirect } from 'next/navigation'
import { FormPersona } from '@/components/persone/FormPersona'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { creaPersonaAzione } from '../actions'

export default async function PaginaNuovaPersona() {
  const sessione = await sessioneCorrente()
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
