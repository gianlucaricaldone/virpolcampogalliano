// Estratto da dove-siamo/page.tsx per il budget di ~150 righe: le tre
// modalità per raggiungere il centro sportivo, testi verbatim dal sito
// vecchio (in auto, mezzi pubblici, treno).
const MODALITA = [
  {
    titolo: 'In Auto',
    sottotitolo: 'Il modo più comodo per raggiungerci',
    voci: [
      {
        titolo: 'Da Modena',
        testo: 'Prendi la SS9 direzione Carpi, uscita Campogalliano Centro. Segui le indicazioni per il centro sportivo.',
      },
      {
        titolo: 'Da Carpi',
        testo: "Direzione Modena sulla SS9, uscita Campogalliano Centro. Il centro sportivo è a 2 km dall'uscita.",
      },
    ],
    nota: 'Parcheggio gratuito disponibile',
  },
  {
    titolo: 'Con i Mezzi Pubblici',
    sottotitolo: 'Servizio autobus urbano ed extraurbano',
    voci: [
      {
        titolo: 'Linea 7 SETA',
        testo: 'Da Modena Autostazione: fermata "Campogalliano Centro". Tempo di percorrenza: 25 minuti.',
      },
      {
        titolo: 'Linea 12 SETA',
        testo: 'Da Carpi: fermata "Campogalliano Scuole". Tempo di percorrenza: 15 minuti.',
      },
    ],
    nota: 'Dal centro del paese, il centro sportivo è raggiungibile a piedi in 8 minuti.',
  },
  {
    titolo: 'In Treno',
    sottotitolo: 'Collegamento ferroviario regionale',
    voci: [
      {
        titolo: 'Stazione Campogalliano',
        testo: 'Linea Modena-Mantova. La stazione dista 1,5 km dal centro sportivo.',
      },
      {
        titolo: 'Collegamenti',
        testo: 'Da Modena: ogni 30 minuti (10 min di viaggio). Da Carpi: ogni ora (8 min di viaggio).',
      },
    ],
    nota: 'Dalla stazione: autobus urbano o taxi disponibili.',
  },
]

export function ComeRaggiungerci() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-neutral-900">
          Come <span className="text-blue-600">Raggiungerci</span>
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {MODALITA.map((m) => (
            <div key={m.titolo} className="rounded-lg border bg-white p-6 shadow-sm">
              <p className="font-semibold text-neutral-900">{m.titolo}</p>
              <p className="text-sm text-neutral-500">{m.sottotitolo}</p>
              <div className="mt-4 space-y-3">
                {m.voci.map((v) => (
                  <div key={v.titolo}>
                    <p className="text-sm font-semibold text-neutral-800">{v.titolo}</p>
                    <p className="text-sm text-neutral-600">{v.testo}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 border-t pt-3 text-xs text-neutral-500">{m.nota}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
