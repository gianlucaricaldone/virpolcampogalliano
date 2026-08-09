import type { Metadata } from 'next'
import { ComeRaggiungerci } from '@/components/pubblico/ComeRaggiungerci'
import { MappaIndirizzo } from '@/components/pubblico/MappaIndirizzo'

// Porta dal vecchio app/dove-siamo/page.tsx (329 righe): indirizzo, contatti,
// orari, mappa (in MappaIndirizzo) e le tre modalità per arrivare (in
// ComeRaggiungerci) — estratti per il budget di ~150 righe. Cade l'immagine
// decorativa Unsplash della sezione "Servizi e Strutture" (hotlinked, non
// fra gli asset copiati nel Task 2) e le icone lucide-react, assenti dal
// progetto: restano le sole etichette testuali.
export const metadata: Metadata = {
  title: 'Dove Siamo — Virpol Campogalliano',
  description:
    'Indirizzo, orari di apertura e indicazioni per raggiungere il Centro Sportivo Virpol.',
}

const SERVIZI = [
  { titolo: '2 Campi Regolamentari', testo: 'Erba sintetica di ultima generazione' },
  { titolo: 'Parcheggio Gratuito', testo: '150 posti auto disponibili' },
  { titolo: 'Bar e Ristoro', testo: 'Servizio completo di ristorazione' },
  { titolo: 'Spogliatoi Moderni', testo: '8 spogliatoi attrezzati' },
]

export default function PaginaDoveSiamo() {
  return (
    <>
      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-5xl font-bold text-neutral-900">Dove Siamo</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600">
            Il nostro centro sportivo si trova nel cuore di Campogalliano,
            facilmente raggiungibile e dotato di tutti i servizi.
          </p>
        </div>
      </section>

      <MappaIndirizzo />
      <ComeRaggiungerci />

      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold text-neutral-900">
            Servizi e <span className="text-blue-600">Strutture</span>
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Tutto quello che serve per un&apos;esperienza sportiva completa.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6">
            {SERVIZI.map((s) => (
              <div key={s.titolo} className="rounded-lg border bg-white p-4">
                <p className="font-semibold text-neutral-900">{s.titolo}</p>
                <p className="text-sm text-neutral-600">{s.testo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-bold">Vieni a Trovarci</h2>
          <p className="mt-4 text-lg text-blue-100">
            Il nostro centro sportivo ti aspetta. Vieni a vedere le nostre
            strutture o partecipa a uno dei nostri eventi.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="tel:059123456"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-600 hover:bg-neutral-100"
            >
              Chiamaci Ora
            </a>
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white hover:text-blue-600"
            >
              Indicazioni Stradali
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
