import type { Metadata } from 'next'
import { ChiSiamo } from '@/components/pubblico/ChiSiamo'
import { Hero } from '@/components/pubblico/Hero'
import { Numeri } from '@/components/pubblico/Numeri'
import { clientPubblico } from '@/lib/supabase/pubblico'

// Title e description presi dal testo stesso della home vecchia (il tag
// principale del sito vecchio, in app/layout.tsx, era quello del gestionale:
// "Virpol Campogalliano - Sistema Gestionale", non della vetrina pubblica).
export const metadata: Metadata = {
  title: 'Virpol Campogalliano — Società Sportiva',
  description:
    'Dove la passione per il calcio diventa famiglia. Formazione, crescita e successi.',
}

// La home legge il database da quando i numeri non sono più scritti a mano, e
// segue /squadre: stessa cadenza di rivalidazione e stesso client anonimo, che
// non passa da `cookies()` — `supabaseServer` renderebbe la rotta dinamica e
// questo `revalidate` non varrebbe più nulla (vedi lib/supabase/pubblico.ts).
export const revalidate = 3600

export default async function Home() {
  // `maybeSingle` e non `single`: la view non restituisce nessuna riga quando
  // non c'è una stagione aperta, ed è un esito previsto — con `single`
  // arriverebbe qui come errore PGRST116.
  const { data, error } = await clientPubblico()
    .from('v_numeri_pubblici')
    .select('squadre, atleti')
    .maybeSingle()
  // Si lancia, non si ripara. Un `?? 0` su un errore renderebbe «sezione
  // assente» indistinguibile da un guasto di lettura: è esattamente il modo in
  // cui una view sbagliata mostrerebbe zero in produzione senza un log.
  if (error) throw error

  return (
    <>
      <Hero />
      <Numeri
        numeri={data ? { squadre: data.squadre ?? 0, atleti: data.atleti ?? 0 } : null}
      />
      <ChiSiamo />
    </>
  )
}
