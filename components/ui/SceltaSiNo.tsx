'use client'

/**
 * Un SÌ/NO a due pulsanti, per i campi che sono una domanda chiusa: la visita
 * è stata consegnata, il materiale è stato consegnato.
 *
 * Due radio e non una casella. Una casella non spuntata non distingue «no» da
 * «non ho ancora guardato», e su un dato che la segreteria compila a rate la
 * differenza è tutto: col NO esplicito si sa che qualcuno ha controllato.
 *
 * Il `<fieldset>` con la `<legend>` non è cerimonia di accessibilità: dà al
 * gruppo un nome, e quel nome è l'unico modo di distinguere due SÌ/NO sulla
 * stessa pagina — sia per chi usa uno screen reader, sia per un test che deve
 * cliccare il Sì giusto fra i due.
 */
export function SceltaSiNo({
  nome,
  legenda,
  valore,
  cambia,
  errore,
}: {
  /** Nome del campo nel form: arriva alla Server Action come 'si' o 'no'. */
  nome: string
  legenda: string
  valore: boolean
  cambia: (valore: boolean) => void
  errore?: string
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legenda}</legend>
      <div className="mt-1.5 flex overflow-hidden rounded-md border-2 border-[var(--colore-nero)]">
        {[
          { si: true, etichetta: 'Sì' },
          { si: false, etichetta: 'No' },
        ].map((o) => (
          <label
            key={o.etichetta}
            className={`min-h-10 cursor-pointer px-4 py-2 text-sm font-medium ${
              valore === o.si ? 'bg-[var(--colore-giallo)]' : 'bg-white hover:bg-neutral-100'
            }`}
          >
            <input
              type="radio"
              name={nome}
              value={o.si ? 'si' : 'no'}
              checked={valore === o.si}
              onChange={() => cambia(o.si)}
              className="sr-only"
            />
            {o.etichetta}
          </label>
        ))}
      </div>
      {errore && <p role="alert" className="mt-1 text-sm text-red-700">{errore}</p>}
    </fieldset>
  )
}
