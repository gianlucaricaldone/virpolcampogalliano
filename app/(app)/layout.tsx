import { redirect } from 'next/navigation'
import { NavBackoffice } from '@/components/layout/NavBackoffice'
import { getSessione } from '@/lib/auth/session'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function LayoutBackoffice({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  // Non solo '/login': un utente qui arriva sempre con un cookie di sessione
  // Supabase Auth valido (il middleware ha già respinto chi ne è privo), ma
  // getSessione torna null se il profilo è stato disattivato o cancellato.
  // Senza il parametro, il middleware vedrebbe comunque uno `user` autenticato
  // su /login e rimbalzerebbe verso /gestione, che rimbalza di nuovo qui:
  // ERR_TOO_MANY_REDIRECTS, senza modo di raggiungere il form di accesso.
  if (!sessione) redirect('/login?sessione=terminata')

  const stagioni = await elencaStagioni(db)

  return (
    <div className="min-h-dvh bg-neutral-50">
      <NavBackoffice ruolo={sessione.ruolo} stagioni={stagioni} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  )
}
