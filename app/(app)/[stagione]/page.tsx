import { etichettaDaCodice } from '@/lib/domain/stagione'

export default async function Cruscotto({ params }: { params: Promise<{ stagione: string }> }) {
  const { stagione } = await params
  return (
    <section>
      <h1 className="text-xl font-semibold">Stagione {etichettaDaCodice(stagione)}</h1>
      <p className="mt-2 text-neutral-600">
        Il cruscotto delle scadenze arriva con la gestione delle quote.
      </p>
    </section>
  )
}
