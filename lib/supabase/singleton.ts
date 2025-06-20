import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

let supabaseInstance: any | null = null

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClientComponentClient<Database>()
  }
  return supabaseInstance
}

// Cache per query frequenti
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

// Auth state cache
let authStateCache: { user: any; profile: any; timestamp: number } | null = null
const AUTH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getCachedAuthState() {
  if (!authStateCache) return null
  
  const now = Date.now()
  if (now > authStateCache.timestamp + AUTH_CACHE_TTL) {
    authStateCache = null
    return null
  }
  
  return authStateCache
}

export function setCachedAuthState(user: any, profile: any) {
  authStateCache = {
    user,
    profile,
    timestamp: Date.now()
  }
}

export function clearCachedAuthState() {
  authStateCache = null
}

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
  
  const keysToDelete: string[] = []
  queryCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => queryCache.delete(key))
}