// Porta i testi integrali della sezione «Chi Siamo» del vecchio app/page.tsx
// (righe 239-280): titolo, i due paragrafi e le tre parole-valore. Cade la
// griglia di foto stock decorative sulla destra (4 URL Unsplash hotlinked,
// non fra gli asset copiati nel Task 2) e il bottone «Scopri di più», che nel
// vecchio sito puntava a /storia — pagina fuori perimetro nel piano nuovo.
export function ChiSiamo() {
  return (
    <section id="chi-siamo" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-6 text-5xl font-bold text-neutral-900">
          La Nostra <span className="text-blue-600">Storia</span>
        </h2>
        <p className="mb-6 text-xl leading-relaxed text-neutral-600">
          Dal 2009, la <strong>Virpol Campogalliano</strong> rappresenta un punto
          di riferimento nel panorama calcistico locale. Nata dalla passione di
          un gruppo di amici, oggi è cresciuta fino a diventare una vera e
          propria famiglia.
        </p>
        <p className="mb-8 text-lg leading-relaxed text-neutral-600">
          La nostra missione è quella di far crescere i giovani atleti non solo
          dal punto di vista tecnico, ma anche umano, trasmettendo i valori
          dello sport e del rispetto reciproco.
        </p>

        <div className="grid grid-cols-3 gap-6">
          <div className="rounded-xl bg-red-50 p-4 text-center">
            <div className="font-semibold text-neutral-900">Passione</div>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <div className="font-semibold text-neutral-900">Formazione</div>
          </div>
          <div className="rounded-xl bg-yellow-50 p-4 text-center">
            <div className="font-semibold text-neutral-900">Eccellenza</div>
          </div>
        </div>
      </div>
    </section>
  )
}
