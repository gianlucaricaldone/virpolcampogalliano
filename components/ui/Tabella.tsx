/**
 * Cornice condivisa delle tabelle.
 *
 * Due ragioni, nessuna delle quali è la coerenza per la coerenza.
 *
 * La prima: **lo scroll orizzontale deve stare dentro la tabella, non sulla
 * pagina**. Le tabelle di questo backoffice hanno da quattro a sei colonne, e
 * su un telefono da 390px allargavano l'intero documento — il contenuto usciva
 * dallo sfondo, la barra di navigazione restava indietro, e per leggere una
 * riga bisognava trascinare tutta la pagina.
 *
 * La seconda: intestazioni e celle si vestono qui, con le varianti fra
 * parentesi quadre, invece che riga per riga in dieci componenti. Le
 * intestazioni sono grigie e minuscole perché sono etichette, non contenuto:
 * prima erano nero grassetto e pesavano quanto i dati sotto.
 */
export function Tabella({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table
        className="w-full border-collapse text-sm
          [&_thead]:bg-neutral-50
          [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium
          [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-neutral-500
          [&_td]:px-4 [&_td]:py-3
          [&_tbody_tr]:border-t"
      >
        {children}
      </table>
    </div>
  )
}
