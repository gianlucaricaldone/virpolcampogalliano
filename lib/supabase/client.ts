import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export const createClient = () => {
  // Create client with extended session duration (60 days)
  return createClientComponentClient<Database>({
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // 60 giorni in secondi (60 * 24 * 60 * 60)
        refreshThreshold: 300, // Refresh 5 minuti prima della scadenza
        detectSessionInUrl: true
      }
    }
  })
}