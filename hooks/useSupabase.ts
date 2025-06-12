import { useMemo } from 'react'
import { getSupabaseClient } from '@/lib/supabase/singleton'

export function useSupabase() {
  return useMemo(() => getSupabaseClient(), [])
}