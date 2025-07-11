'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { parametriApi } from '@/lib/api/parametri'
import { CACHE_DURATIONS } from '@/lib/constants'
import { useAuth } from '@/hooks/useAuth'
import { Database } from '@/types/database'

export type StagioneSportiva = Database['public']['Tables']['stagioni_sportive']['Row']

interface SeasonContextType {
  stagioneCorrente: StagioneSportiva | null
  stagioni: StagioneSportiva[]
  loading: boolean
  error: string | null
  refreshStagioni: () => Promise<void>
  setStagioneCorrente: (stagioneId: string) => Promise<void>
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined)

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [stagioneCorrente, setStagioneCorrenteState] = useState<StagioneSportiva | null>(null)
  const [stagioni, setStagioni] = useState<StagioneSportiva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const fetchStagioni = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = 'stagioni_and_stagione_corrente'
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = getCachedQuery<{stagioni: StagioneSportiva[], stagioneCorrente: StagioneSportiva | null}>(cacheKey)
      if (cachedData) {
        console.log('[SeasonContext] Using cached stagioni and stagione corrente data')
        setStagioni(cachedData.stagioni)
        setStagioneCorrenteState(cachedData.stagioneCorrente)
        setLoading(false)
        return
      }
    }

    // Check if there's already an ongoing fetch
    if (fetchingRef.current) {
      console.log('[SeasonContext] Fetch already in progress, skipping duplicate request')
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      setError(null)
      
      console.log('[SeasonContext] Fetching stagioni and stagione corrente from API')
      
      // Use centralized API
      const { stagioni: stagioniData, stagioneCorrente } = await parametriApi.getStagioniAndParametri()

      // Cache the result
      setCachedQuery(cacheKey, { stagioni: stagioniData, stagioneCorrente }, CACHE_DURATIONS.SQUADRE) // 5 minutes
      console.log('[SeasonContext] Data cached for', CACHE_DURATIONS.SQUADRE / 1000, 'seconds')

      setStagioni(stagioniData)
      setStagioneCorrenteState(stagioneCorrente)
    } catch (err) {
      console.error('[SeasonContext] Error fetching stagioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento delle stagioni')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const setStagioneCorrente = async (stagioneId: string) => {
    try {
      // Use centralized API
      await parametriApi.setStagioneCorrente(stagioneId)
      
      // Force refresh to get updated data
      await fetchStagioni(true)
    } catch (err) {
      console.error('Error setting stagione corrente:', err)
      throw err
    }
  }

  const refreshStagioni = async () => {
    await fetchStagioni(true) // Force refresh
  }

  useEffect(() => {
    // Carica i dati solo se l'utente è autenticato
    if (profile) {
      fetchStagioni()
    }
  }, [profile, fetchStagioni])

  const value: SeasonContextType = {
    stagioneCorrente,
    stagioni,
    loading,
    error,
    refreshStagioni,
    setStagioneCorrente
  }

  return (
    <SeasonContext.Provider value={value}>
      {children}
    </SeasonContext.Provider>
  )
}

export function useSeason() {
  const context = useContext(SeasonContext)
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider')
  }
  return context
}