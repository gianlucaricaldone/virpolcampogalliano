import type { Metadata } from 'next'
import { IndirizzoCentro } from '@/components/pubblico/IndirizzoCentro'
import { SEDE } from '@/lib/costanti'

// La pagina diceva molte cose e ne sapeva poche. Erano ricopiate dal sito
// vecchio, come imponeva il piano («in caso di dubbio su un contenuto: si copia,
// non si riscrive»), e nessuna era verificata: l'indirizzo era «Via dello Sport,
// 1», le coordinate GPS scritte a mano, il centro si chiamava «Centro Sportivo
// Virpol», e attorno c'erano le linee 7 e 12 di SETA con i minuti di percorrenza,
// «2 campi regolamentari», «150 posti auto», «8 spogliatoi» e un telefono
// segnaposto sotto il pulsante «Chiamaci Ora».
//
// Resta ciò che si può verificare: il nome vero del centro, l'indirizzo vero, e
// due pulsanti che ci portano davvero. Il resto torna quando qualcuno lo conta.
export const metadata: Metadata = {
  title: 'Dove Siamo — Virpol Campogalliano',
  description: `Indirizzo e indicazioni per raggiungere il ${SEDE.centro} di Campogalliano.`,
}

export default function PaginaDoveSiamo() {
  return (
    <>
      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-5xl font-bold text-neutral-900">Dove Siamo</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600">
            Ci alleniamo e giochiamo al {SEDE.centro}, in {SEDE.via} a
            Campogalliano.
          </p>
        </div>
      </section>

      <IndirizzoCentro />
    </>
  )
}
