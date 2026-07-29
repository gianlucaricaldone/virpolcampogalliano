import { redirect } from 'next/navigation'
import { NavBackoffice } from '@/components/layout/NavBackoffice'
import { getSessione } from '@/lib/auth/session'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function LayoutBackoffice({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  if (!sessione) redirect('/login')

  const stagioni = await elencaStagioni(db)

  return (
    <div className="min-h-dvh bg-neutral-50">
      <NavBackoffice ruolo={sessione.ruolo} stagioni={stagioni} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  )
}
