'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Squadra {
  id: string
  nome: string
  categoria: string
  annata: number
  foto_squadra: string | null
  created_at: string
  updated_at: string
}

export function useSquadre() {
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchSquadre() {
      try {
        const { data, error } = await supabase
          .from('squadre')
          .select('*')
          .order('annata', { ascending: false })

        if (error) {
          console.error('Errore nel caricamento squadre:', error)
          setError(error.message)
          // Fallback ai dati mock se il database non è disponibile
          setSquadre(getMockSquadre())
        } else {
          setSquadre(data || [])
        }
      } catch (err) {
        console.error('Errore di connessione:', err)
        setError('Errore di connessione al database')
        // Fallback ai dati mock
        setSquadre(getMockSquadre())
      } finally {
        setLoading(false)
      }
    }

    fetchSquadre()
  }, [supabase])

  return { squadre, loading, error }
}

// Dati mock per fallback quando il database non è disponibile
function getMockSquadre(): Squadra[] {
  return [
    {
      id: 'prima-squadra',
      nome: 'Prima Squadra',
      categoria: 'Senior',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'juniores',
      nome: 'Juniores',
      categoria: 'Under 19',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'allievi',
      nome: 'Allievi',
      categoria: 'Under 17',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'giovanissimi',
      nome: 'Giovanissimi',
      categoria: 'Under 15',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'esordienti',
      nome: 'Esordienti',
      categoria: 'Under 13',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'scuola-calcio',
      nome: 'Scuola Calcio',
      categoria: 'Piccoli Amici',
      annata: 2024,
      foto_squadra: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    }
  ]
}