import { redirect } from 'next/navigation'
import { FormStagione } from '@/components/stagioni/FormStagione'
import { TabellaStagioni } from '@/components/stagioni/TabellaStagioni'
import { getSessione } from '@/lib/auth/session'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function PaginaStagioni() {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  if (sessione?.ruolo !== 'admin') redirect('/gestione')

  const stagioni = await elencaStagioni(db)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Stagioni sportive</h1>
      <FormStagione />
      <TabellaStagioni stagioni={stagioni} />
    </section>
  )
}
