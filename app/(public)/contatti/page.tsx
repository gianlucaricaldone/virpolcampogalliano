import type { Metadata } from 'next'
import Link from 'next/link'
import { SEDE } from '@/lib/costanti'

// La pagina pubblicava cinque numeri di telefono segnaposto (059 123456, 347
// 1234567, 335 9876543, 328 5551234, 333 1234567), tre referenti di nome Marco
// Rossi, Andrea Bianchi e Giuseppe Viola, quattro email su un dominio non
// verificato e un terzo set di orari di segreteria diverso dagli altri due del
// sito. Erano ricopiati dal sito vecchio, dove erano già inventati.
//
// Un recapito falso è peggio di un recapito assente: chi lo trova chiama, non
// risponde nessuno, e conclude che la società non risponde. Quindi via tutto, e
// al suo posto un avviso che dice come stanno le cose. Torneranno quando ci
// saranno quelli veri — è l'unica cosa che questa pagina può promettere.
export const metadata: Metadata = {
  title: 'Contatti — Virpol Campogalliano',
  description: 'La pagina dei contatti è in lavorazione. Ci trovi al centro sportivo.',
}

export default function PaginaContatti() {
  return (
    <>
      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-5xl font-bold text-neutral-900">Contattaci</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600">
            Stiamo mettendo in ordine i recapiti della società.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border-2 border-yellow-400 bg-white p-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Lavori in corso
            </p>
            <h2 className="mt-3 text-3xl font-bold text-neutral-900">
              Questa pagina sta per essere rifatta
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600">
              Telefoni e indirizzi email della società saranno pubblicati qui
              appena verificati. Nel frattempo il riferimento certo è il campo:
              ci trovi agli allenamenti e alle partite.
            </p>

            <address className="mt-8 not-italic leading-relaxed text-neutral-700">
              <span className="block font-semibold text-neutral-900">{SEDE.centro}</span>
              {SEDE.via}
              <br />
              {SEDE.comune}
            </address>

            <Link href="/dove-siamo" className="mt-6 inline-block font-medium underline">
              Come arrivare →
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
