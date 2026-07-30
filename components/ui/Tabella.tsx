/**
 * Cornice condivisa delle tabelle.
 *
 * Esiste per una ragione sola, e non è la coerenza: **lo scroll orizzontale
 * deve stare dentro la tabella, non sulla pagina**. Le tabelle di questo
 * backoffice hanno da quattro a sei colonne, e su un telefono da 390px
 * allargavano l'intero documento — il contenuto usciva dallo sfondo, la barra
 * di navigazione restava indietro, e per leggere una riga bisognava trascinare
 * tutta la pagina. Con `overflow-x-auto` sul contenitore scorre solo la
 * tabella, e il resto della schermata sta fermo.
 *
 * Prima questa stringa di classi era copiata in dieci componenti.
 */
export function Tabella({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}
