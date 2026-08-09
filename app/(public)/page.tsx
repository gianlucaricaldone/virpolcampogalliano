import type { Metadata } from 'next'
import { ChiSiamo } from '@/components/pubblico/ChiSiamo'
import { Hero } from '@/components/pubblico/Hero'
import { Numeri } from '@/components/pubblico/Numeri'

// Title e description presi dal testo stesso della home vecchia (il tag
// principale del sito vecchio, in app/layout.tsx, era quello del gestionale:
// "Virpol Campogalliano - Sistema Gestionale", non della vetrina pubblica).
export const metadata: Metadata = {
  title: 'Virpol Campogalliano — Società Sportiva',
  description:
    'Dove la passione per il calcio diventa famiglia. Formazione, crescita e successi dal 2009.',
}

export default function Home() {
  return (
    <>
      <Hero />
      <Numeri />
      <ChiSiamo />
    </>
  )
}
