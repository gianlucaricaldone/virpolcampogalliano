'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export interface StagioneSportiva {
  id: string
  nome: string
  data_inizio: string
  data_fine: string
  attiva: boolean
  archiviata: boolean
  descrizione?: string | null
  created_at: string
  updated_at: string
}

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
  const supabase = createClient()

  const fetchStagioni = async () => {
    try {
      setError(null)
      
      // Carica tutte le stagioni
      const { data: stagioniData, error: stagioniError } = await supabase
        .from('stagioni_sportive')
        .select('*')
        .order('data_inizio', { ascending: false })

      if (stagioniError) throw stagioniError

      setStagioni(stagioniData || [])

      // Carica la stagione corrente dai parametri sistema
      const { data: parametriData, error: parametriError } = await supabase
        .from('parametri_sistema')
        .select('valore')
        .eq('chiave', 'stagione_corrente_id')
        .single()

      if (parametriError && parametriError.code !== 'PGRST116') { // PGRST116 = no rows
        throw parametriError
      }

      const stagioneCorrenteId = parametriData?.valore

      if (stagioneCorrenteId && stagioniData) {
        const stagione = stagioniData.find(s => s.id === stagioneCorrenteId)
        setStagioneCorrenteState(stagione || null)
      } else {
        setStagioneCorrenteState(null)
      }

    } catch (err) {
      console.error('Error fetching stagioni:', err)
      setError(err instanceof Error ? err.message : 'Errore nel caricamento delle stagioni')
    } finally {
      setLoading(false)
    }
  }

  const setStagioneCorrente = async (stagioneId: string) => {
    try {
      // Prima disattiva tutte le stagioni
      await supabase
        .from('stagioni_sportive')
        .update({ attiva: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // dummy condition

      // Attiva la stagione selezionata
      await supabase
        .from('stagioni_sportive')
        .update({ attiva: true })
        .eq('id', stagioneId)

      // Aggiorna il parametro sistema
      await supabase
        .from('parametri_sistema')
        .update({ valore: stagioneId })
        .eq('chiave', 'stagione_corrente_id')

      // Ricarica i dati
      await fetchStagioni()
    } catch (err) {
      console.error('Error setting stagione corrente:', err)
      throw err
    }
  }

  const refreshStagioni = async () => {
    await fetchStagioni()
  }

  useEffect(() => {
    // Carica i dati solo se l'utente è autenticato
    if (profile) {
      fetchStagioni()
    }
  }, [profile])

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