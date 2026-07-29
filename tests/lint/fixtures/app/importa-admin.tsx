// Sorgente di prova: deve violare la regola no-restricted-imports.
// Non fa parte dell'applicazione e non viene compilato da Next.
import { supabaseAdmin } from '@/lib/supabase/admin'

export function Cattivo() {
  return <span>{String(supabaseAdmin)}</span>
}
