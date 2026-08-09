// Sorgente di prova: deve violare la regola no-restricted-imports.
// Non fa parte dell'applicazione e non viene compilato da Next.
import { leggiTutto } from '@/scripts/migrazione/vecchio'

export function Cattivo() {
  return <span>{String(leggiTutto)}</span>
}
