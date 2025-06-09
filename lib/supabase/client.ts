import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export const createClient = () => {
  // Simply create and return the client
  // The auth-helpers will automatically read from process.env
  return createClientComponentClient<Database>()
}