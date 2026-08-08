// Sorgente di prova: deve violare la regola no-restricted-imports.
// Non fa parte dell'applicazione e non viene compilato da Next.
import { supabaseServizio } from '@/lib/supabase/servizio'

export function Cattivo() {
  return <span>{String(supabaseServizio)}</span>
}
