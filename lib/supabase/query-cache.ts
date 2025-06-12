// Simple in-memory cache for preventing duplicate queries
const queryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5000 // 5 seconds

export function getCachedQuery(key: string) {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

export function setCachedQuery(key: string, data: any) {
  queryCache.set(key, { data, timestamp: Date.now() })
}

export function clearQueryCache() {
  queryCache.clear()
}