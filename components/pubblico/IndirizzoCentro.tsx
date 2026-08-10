import { linkGoogleMaps, linkWaze, SEDE } from '@/lib/costanti'

/**
 * L'indirizzo della sede e i due modi di farsi portare lì.
 *
 * PRENDE IL POSTO DI `MappaIndirizzo`, CHE NON AVEVA UNA MAPPA. Quel componente
 * mostrava un rettangolo grigio alto 384px con dentro la scritta «Mappa
 * Interattiva» e due coordinate GPS scritte a mano, più un telefono e tre orari
 * che nessuno aveva verificato. Il nome del file prometteva una cosa che dentro
 * non c'era, ed è per questo che è stato rinominato invece di riadattato.
 *
 * Niente mappa incorporata al suo posto: un iframe di Google porta cookie di
 * terze parti, e un sito senza avviso cookie non se li può permettere. Chi legge
 * questa pagina la legge quasi sempre dal telefono e vuole una cosa sola — che
 * si apra il navigatore — ed è esattamente quello che fanno i due pulsanti.
 */
export function IndirizzoCentro() {
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold text-neutral-900">
          Il Centro <span className="text-blue-600">Sportivo</span>
        </h2>

        <address className="mt-8 text-lg not-italic leading-relaxed text-neutral-700">
          <span className="block font-semibold text-neutral-900">{SEDE.centro}</span>
          {SEDE.via}
          <br />
          {SEDE.comune}
        </address>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={linkGoogleMaps()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            Apri in Google Maps
          </a>
          <a
            href={linkWaze()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-neutral-900 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Naviga con Waze
          </a>
        </div>
      </div>
    </section>
  )
}
