export type NumeriPubblici = { squadre: number; atleti: number }

/**
 * I numeri della stagione in corso, letti da `v_numeri_pubblici`.
 *
 * Prima erano quattro cifre scritte a mano — «15+ Anni di Storia», «8 Squadre
 * Attive», «180+ Atleti Tesserati», «42+ Trofei Vinti» — ereditate dai valori di
 * fallback di un hook del sito vecchio. Due erano contraddette dalla pagina
 * accanto, che le squadre le legge dal database; le altre due non avevano
 * sorgente e sono sparite: l'anno di fondazione non è noto e dei trofei non
 * esiste un registro.
 *
 * NON SI PUBBLICA UNO ZERO. Un riquadro a zero non si rende, e se non c'è
 * nessuna stagione aperta (`numeri` nullo) la sezione intera non compare: «0
 * atleti tesserati» di una società sportiva non è un dato, è un annuncio di
 * chiusura. Il guardiano sta qui e non nella pagina, così la decisione di cosa
 * vale la pena mostrare vive in un posto solo.
 */
export function Numeri({ numeri }: { numeri: NumeriPubblici | null }) {
  if (!numeri) return null

  const riquadri = [
    { chiave: 'squadre', valore: numeri.squadre, etichetta: 'Squadre Attive' },
    { chiave: 'atleti', valore: numeri.atleti, etichetta: 'Atleti Tesserati' },
  ].filter((r) => r.valore > 0)

  if (riquadri.length === 0) return null

  return (
    <section className="bg-gradient-to-r from-yellow-400 to-blue-600 py-20 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold">I Nostri Numeri</h2>
          <p className="text-xl text-yellow-100">La stagione in corso, in due numeri</p>
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 text-center">
          {riquadri.map(({ chiave, valore, etichetta }) => (
            // `data-numero` è l'unico attributo di test del repo, ed è
            // un'eccezione dichiarata: i due riquadri possono mostrare la stessa
            // cifra, e un E2E che cercasse il testo «2» prenderebbe quello
            // sbagliato senza dirlo.
            <div key={chiave} data-numero={chiave} className="rounded-2xl bg-white/10 p-6">
              <div className="mb-2 text-4xl font-bold">{valore}</div>
              <div className="text-yellow-100">{etichetta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
