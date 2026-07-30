import { redirect } from 'next/navigation'
import { NavBackoffice } from '@/components/layout/NavBackoffice'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { caricaStagioni } from './dati'

export default async function LayoutBackoffice({ children }: { children: React.ReactNode }) {
  // Le due letture non dipendono l'una dall'altra: in serie sarebbero due
  // round trip in fila prima ancora che la pagina cominci a caricare i suoi.
  const [sessione, stagioni] = await Promise.all([sessioneCorrente(), caricaStagioni()])

  // Non solo '/login': un utente qui arriva sempre con un cookie di sessione
  // Supabase Auth valido (il middleware ha già respinto chi ne è privo), ma
  // getSessione torna null se il profilo è stato disattivato o cancellato.
  // Senza il parametro, il middleware vedrebbe comunque uno `user` autenticato
  // su /login e rimbalzerebbe verso /gestione, che rimbalza di nuovo qui:
  // ERR_TOO_MANY_REDIRECTS, senza modo di raggiungere il form di accesso.
  if (!sessione) redirect('/login?sessione=terminata')

  return (
    <div className="min-h-dvh bg-neutral-50">
      <NavBackoffice ruolo={sessione.ruolo} stagioni={stagioni} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  )
}
