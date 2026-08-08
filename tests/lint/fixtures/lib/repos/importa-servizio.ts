// Sorgente di prova: un repository non deve poter costruire un client che
// ignora le RLS, nemmeno passando dal modulo nuovo.
import { supabaseServizio } from '../../../../lib/supabase/servizio'

export const cattivo = () => supabaseServizio()
