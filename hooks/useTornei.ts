'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Torneo {
  id: string
  nome: string
  data_inizio: string
  data_fine: string
  stato: string
  regolamento: any
  costo_iscrizione: number | null
  created_at: string
  updated_at: string
}

export interface IscrizedTorneo {
  id: string
  torneo_id: string
  nome_societa: string
  email_contatto: string
  telefono_contatto: string | null
  numero_squadre: number
  documenti: any
  stato_iscrizione: string
  created_at: string
  updated_at: string
}

export function useTornei() {
  const [tornei, setTornei] = useState<Torneo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTornei() {
      try {
        const { data, error } = await supabase
          .from('tornei')
          .select('*')
          .order('data_inizio', { ascending: true })

        if (error) {
          console.error('Errore nel caricamento tornei:', error)
          setError(error.message)
          // Fallback ai dati mock se il database non è disponibile
          setTornei(getMockTornei())
        } else {
          setTornei(data || [])
        }
      } catch (err) {
        console.error('Errore di connessione:', err)
        setError('Errore di connessione al database')
        // Fallback ai dati mock
        setTornei(getMockTornei())
      } finally {
        setLoading(false)
      }
    }

    fetchTornei()
  }, [supabase])

  return { tornei, loading, error }
}

export function useNews() {
  const [news, setNews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Per ora usiamo dati mock per le news
    // In futuro si può creare una tabella 'news' nel database
    setNews(getMockNews())
    setLoading(false)
  }, [])

  return { news, loading, error }
}

// Dati mock per fallback quando il database non è disponibile
function getMockTornei(): Torneo[] {
  return [
    {
      id: 'primavera-u15',
      nome: 'Torneo Primavera U15',
      data_inizio: '2024-06-15',
      data_fine: '2024-06-16',
      stato: 'iscrizioni_aperte',
      regolamento: { categoria: 'Under 15', numero_squadre: 16 },
      costo_iscrizione: 150,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'estate-calcio',
      nome: 'Festival del Calcio Estivo',
      data_inizio: '2024-07-20',
      data_fine: '2024-07-22',
      stato: 'sold_out',
      regolamento: { categoria: 'Multiple', numero_squadre: 32 },
      costo_iscrizione: 200,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'memorial-rossi',
      nome: 'Memorial Franco Rossi',
      data_inizio: '2024-08-10',
      data_fine: '2024-08-11',
      stato: 'iscrizioni_aperte',
      regolamento: { categoria: 'Prima Squadra', numero_squadre: 8 },
      costo_iscrizione: 300,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    }
  ]
}

function getMockNews() {
  return [
    {
      id: 1,
      titolo: 'Vittoria Storica della Prima Squadra',
      data: '15 Marzo 2024',
      categoria: 'Prima Squadra',
      immagine: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      excerpt: 'Grande prestazione contro la capolista, vittoria 3-1 che ci avvicina ai playoff.',
      featured: true,
      content: 'Una prestazione maiuscola della nostra Prima Squadra che ha battuto 3-1 la capolista del campionato. Gol di Rossi, Bianchi e Verdi hanno regalato tre punti fondamentali per la corsa ai playoff.'
    },
    {
      id: 2,
      titolo: 'Torneo Primavera: Iscrizioni Aperte',
      data: '12 Marzo 2024',
      categoria: 'Tornei',
      immagine: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      excerpt: 'Al via le iscrizioni per il torneo giovanile più atteso dell\'anno.',
      featured: false,
      content: 'Sono aperte le iscrizioni per il Torneo Primavera U15, l\'evento più importante per le categorie giovanili. Partecipazione aperta a 16 squadre.'
    },
    {
      id: 3,
      titolo: 'Nuove Attrezzature per la Scuola Calcio',
      data: '10 Marzo 2024',
      categoria: 'Scuola Calcio',
      immagine: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      excerpt: 'Investimento in nuovi materiali didattici per i nostri piccoli campioni.',
      featured: false,
      content: 'La società ha investito in nuove attrezzature didattiche per la Scuola Calcio: palloni, coni, porte mobili e materiale per l\'allenamento coordinativo.'
    }
  ]
}