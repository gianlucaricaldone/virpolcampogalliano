// Sorgente di prova: envScript espone la chiave service role tanto quanto
// supabaseAdmin — importarlo fuori da scripts/ e passarlo a createClient
// produce lo stesso client che ignora ogni RLS, aggirando la regola esistente.
import { envScript } from '../../scripts/env'

export const cattivo = () => envScript()
