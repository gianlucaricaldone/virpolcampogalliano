import { redirect } from 'next/navigation'
import { FormStagione } from '@/components/stagioni/FormStagione'
import { TabellaStagioni } from '@/components/stagioni/TabellaStagioni'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { caricaStagioni } from '../../dati'

export default async function PaginaStagioni() {
  // `caricaStagioni` è già stata risolta dal layout del backoffice per la
  // barra di navigazione: qui non costa una query in più.
  const [sessione, stagioni] = await Promise.all([sessioneCorrente(), caricaStagioni()])
  if (sessione?.ruolo !== 'admin') redirect('/gestione')

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Stagioni sportive</h1>
      <FormStagione />
      <TabellaStagioni stagioni={stagioni} />
    </section>
  )
}
