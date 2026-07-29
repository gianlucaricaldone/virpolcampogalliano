import { FormAccesso } from '@/components/auth/FormAccesso'

export default async function Accesso({
  searchParams,
}: {
  searchParams: Promise<{ sessione?: string }>
}) {
  const { sessione } = await searchParams
  // ?sessione=terminata arriva da (app)/layout.tsx quando auth.getUser() è
  // riuscito ma il profilo applicativo no (disattivato o cancellato): vedi il
  // commento lì e in middleware.ts.
  const messaggio = sessione === 'terminata'
    ? 'La sessione non è più valida: accedi di nuovo.'
    : undefined

  return <FormAccesso messaggio={messaggio} />
}
