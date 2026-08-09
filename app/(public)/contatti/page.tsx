import type { Metadata } from 'next'
import { RecapitiContatto } from '@/components/pubblico/RecapitiContatto'

// Porta dal vecchio app/contatti/page.tsx (387 righe): i quattro recapiti,
// l'indirizzo, gli orari segreteria, le emergenze e i social — verbatim,
// in RecapitiContatto (estratto per il budget di ~150 righe). Cade tutto il
// client-side: il form della vecchia pagina era `useState` + un `setTimeout`
// che simulava un invio riuscito, senza alcun backend reale. Non c'era nulla
// da rendere Server Component: era finto anche nel sito vecchio, e scriverne
// uno vero (Server Action, invio email) è fuori dal perimetro di questo
// task. Cadono anche le icone lucide-react: la dipendenza non è nel progetto
// e nessun'altra pagina pubblica ne usa — restano etichette testuali dove il
// vecchio sito usava solo un glifo.
const SOCIAL = ['Facebook', 'Instagram', 'YouTube']

export const metadata: Metadata = {
  title: 'Contatti — Virpol Campogalliano',
  description:
    'Recapiti, orari della segreteria e indirizzo del Centro Sportivo Virpol.',
}

export default function PaginaContatti() {
  return (
    <>
      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-5xl font-bold text-neutral-900">Contattaci</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-neutral-600">
            Siamo sempre disponibili per rispondere alle tue domande e aiutarti a
            trovare la soluzione migliore per le tue esigenze sportive.
          </p>
        </div>
      </section>

      <RecapitiContatto />

      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-3xl font-bold text-neutral-900">
            Seguici sui <span className="text-blue-600">Social</span>
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Resta sempre aggiornato su news, risultati e eventi della Virpol
            Campogalliano.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {SOCIAL.map((nome) => (
              <a
                key={nome}
                href="#"
                className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700"
              >
                {nome}
              </a>
            ))}
          </div>
          <p className="mt-8 text-sm text-neutral-500">
            Rispondiamo ai messaggi sui social entro 24 ore.
          </p>
        </div>
      </section>
    </>
  )
}
