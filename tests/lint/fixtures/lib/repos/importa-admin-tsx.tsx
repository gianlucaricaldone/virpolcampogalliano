// Sorgente di prova: come importa-admin.ts ma in .tsx, per tenere sotto
// test l'estensione del glob su lib/repos/.
import { supabaseAdmin } from '../supabase/admin'

export const Cattivo = () => <span>{String(supabaseAdmin)}</span>
