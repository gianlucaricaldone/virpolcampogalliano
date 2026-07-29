// Sorgente di prova: import relativo che il vecchio glob non intercettava.
// Da lib/repos/ il percorso verso lib/supabase/admin non riscrive `lib`.
import { supabaseAdmin } from '../supabase/admin'

export const cattivo = () => String(supabaseAdmin)
