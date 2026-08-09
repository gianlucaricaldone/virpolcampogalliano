// Estratto da dove-siamo/page.tsx per il budget di ~150 righe: indirizzo,
// contatti, orari di apertura e il riquadro mappa. Il vecchio sito non
// incorporava un iframe reale — solo un placeholder grigio con le coordinate
// GPS in overlay ("in produzione si userebbe Google Maps o OpenStreetMap") —
// portato identico, non un vero iframe che qui inventerebbe una funzionalità
// mai esistita.
export function MappaIndirizzo() {
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-neutral-900">
            Centro Sportivo <span className="text-blue-600">Virpol</span>
          </h2>
          <div>
            <p className="font-semibold text-neutral-900">Indirizzo</p>
            <p className="text-neutral-600">Via dello Sport, 1</p>
            <p className="text-neutral-600">41011 Campogalliano (MO)</p>
            <p className="text-neutral-600">Emilia-Romagna, Italia</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-900">Contatti</p>
            <p className="text-neutral-600">Tel: 059 123456</p>
            <p className="text-neutral-600">Email: info@virpolcampogalliano.it</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-900">Orari Apertura</p>
            <p className="text-neutral-600">Lunedì - Venerdì: 16:00 - 22:00</p>
            <p className="text-neutral-600">Sabato: 9:00 - 19:00</p>
            <p className="text-neutral-600">Domenica: 9:00 - 13:00 (solo partite)</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apri in Google Maps
            </a>
            <a
              href="https://waze.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-300 px-6 py-3 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              Naviga con Waze
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="flex h-96 items-center justify-center rounded-lg bg-neutral-200">
            <div className="text-center">
              <p className="text-neutral-500">Mappa Interattiva</p>
              <p className="text-sm text-neutral-400">Centro Sportivo Virpol</p>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 rounded-lg bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-neutral-900">Coordinate GPS</p>
            <p className="text-xs text-neutral-600">44.7234°N, 10.8456°E</p>
          </div>
        </div>
      </div>
    </section>
  )
}
