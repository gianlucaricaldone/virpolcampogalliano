// Porta dal vecchio hooks/useStats.ts i quattro valori di partenza
// (anni_storia: 15, squadre_attive: 8, atleti_tesserati: 180, trofei_vinti:
// 42, con i suffissi che AnimatedCounter applicava) come testo statico:
// il contatore JS e il fetch al database cadono, le cifre restano quelle
// scritte nel vecchio sito.
const NUMERI = [
  { valore: '15+', etichetta: 'Anni di Storia' },
  { valore: '8', etichetta: 'Squadre Attive' },
  { valore: '180+', etichetta: 'Atleti Tesserati' },
  { valore: '42+', etichetta: 'Trofei Vinti' },
]

export function Numeri() {
  return (
    <section className="bg-gradient-to-r from-yellow-400 to-blue-600 py-20 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold">I Nostri Numeri</h2>
          <p className="text-xl text-yellow-100">Una storia di successi e crescita costante</p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {NUMERI.map(({ valore, etichetta }) => (
            <div key={etichetta} className="rounded-2xl bg-white/10 p-6">
              <div className="mb-2 text-4xl font-bold">{valore}</div>
              <div className="text-yellow-100">{etichetta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
