'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Stats {
  anni_storia: number
  squadre_attive: number
  atleti_tesserati: number
  trofei_vinti: number
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    anni_storia: 15,
    squadre_attive: 8,
    atleti_tesserati: 180,
    trofei_vinti: 42
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch squadre attive
        const { data: squadreData, error: squadreError } = await supabase
          .from('squadre')
          .select('id')
          .eq('annata', new Date().getFullYear())

        // Fetch atleti tesserati
        const { data: atletiData, error: atletiError } = await supabase
          .from('tesserati')
          .select('id')
          .eq('stato', true)

        // Fetch trofei (se abbiamo una tabella per i risultati)
        // Per ora usiamo i valori mock
        
        if (squadreError || atletiError) {
          console.error('Errore nel caricamento stats:', squadreError || atletiError)
          setError('Errore nel caricamento statistiche')
          // Mantieni i valori di default
        } else {
          setStats({
            anni_storia: new Date().getFullYear() - 2009, // Anno di fondazione
            squadre_attive: squadreData?.length || 8,
            atleti_tesserati: atletiData?.length || 180,
            trofei_vinti: 42 // Mock per ora
          })
        }
      } catch (err) {
        console.error('Errore di connessione:', err)
        setError('Errore di connessione al database')
        // Mantieni i valori di default
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [supabase])

  return { stats, loading, error }
}