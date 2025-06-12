import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

let supabaseInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClientComponentClient<Database>({
      options: {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          refreshThreshold: 300,
          detectSessionInUrl: true
        }
      }
    })
  }
  return supabaseInstance
}

// Cache per query frequenti
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

export function getCachedQuery<T>(key: string): T | null {
  const cached = queryCache.get(key)
  if (!cached) return null
  
  const now = Date.now()
  if (now > cached.timestamp + cached.ttl) {
    queryCache.delete(key)
    return null
  }
  
  return cached.data as T
}

export function setCachedQuery<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  })
}

export function clearQueryCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear()
    return
  }
  
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
}