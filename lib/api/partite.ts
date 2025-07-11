/**
 * API layer centralizzato per Partite
 * Ottimizzazioni: query unificate, caching, error handling consistente
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Partita = Database['public']['Tables']['partite']['Row'] & {
  squadre?: { nome: string }
  categorie_avversari?: {
    nome_categoria: string
    avversari: {
      nome_societa: string
    }
  }
}

export const partiteApi = {
  /**
   * Ottimizzazione: singola query con JOIN ottimizzati per partite
   */
  async getPartite(filter: 'all' | 'upcoming' | 'past' = 'upcoming'): Promise<Partita[]> {
    const supabase = createClient()
    
    try {
      console.log('[PartiteAPI] Fetching partite with filter:', filter)
      
      let query = supabase
        .from('partite')
        .select(`
          *,
          squadre:squadra_id (nome),
          categorie_avversari:categoria_avversario_id (
            nome_categoria,
            avversari:avversario_id (
              nome_societa
            )
          )
        `)

      const today = new Date().toISOString().split('T')[0]
      
      // Apply date filters based on the filter type
      if (filter === 'upcoming') {
        query = query.gte('data', today)
      } else if (filter === 'past') {
        query = query.lt('data', today)
      }
      // 'all' doesn't need date filtering

      // Apply ordering
      query = query.order('data', { ascending: filter === 'past' ? false : true })

      const { data, error } = await query

      if (error) throw error
      
      console.log('[PartiteAPI] Successfully fetched', (data || []).length, 'partite')
      return data || []
      
    } catch (error) {
      console.error('[PartiteAPI] Error fetching partite:', error)
      throw error
    }
  },

  /**
   * Elimina una partita
   */
  async deletePartita(partitaId: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[PartiteAPI] Deleting partita:', partitaId)
      
      const { error } = await supabase
        .from('partite')
        .delete()
        .eq('id', partitaId)

      if (error) throw error
      
      console.log('[PartiteAPI] Successfully deleted partita')
    } catch (error) {
      console.error('[PartiteAPI] Error deleting partita:', error)
      throw error
    }
  },

  /**
   * Crea una nuova partita
   */
  async createPartita(partitaData: Omit<Database['public']['Tables']['partite']['Insert'], 'id' | 'created_at' | 'updated_at'>): Promise<Database['public']['Tables']['partite']['Row']> {
    const supabase = createClient()

    try {
      console.log('[PartiteAPI] Creating new partita')
      
      const { data, error } = await supabase
        .from('partite')
        .insert(partitaData)
        .select()
        .single()

      if (error) throw error
      
      console.log('[PartiteAPI] Successfully created partita:', data.id)
      return data
    } catch (error) {
      console.error('[PartiteAPI] Error creating partita:', error)
      throw error
    }
  },

  /**
   * Aggiorna una partita esistente
   */
  async updatePartita(partitaId: string, partitaData: Partial<Omit<Database['public']['Tables']['partite']['Update'], 'id' | 'created_at' | 'updated_at'>>): Promise<Database['public']['Tables']['partite']['Row']> {
    const supabase = createClient()

    try {
      console.log('[PartiteAPI] Updating partita:', partitaId)
      
      const { data, error } = await supabase
        .from('partite')
        .update(partitaData)
        .eq('id', partitaId)
        .select()
        .single()

      if (error) throw error
      
      console.log('[PartiteAPI] Successfully updated partita')
      return data
    } catch (error) {
      console.error('[PartiteAPI] Error updating partita:', error)
      throw error
    }
  },

  /**
   * Utility functions per business logic
   */
  getCompetitionColor(tipo: string): string {
    switch (tipo.toLowerCase()) {
      case 'campionato':
        return 'bg-blue-100 text-blue-800'
      case 'coppa':
        return 'bg-purple-100 text-purple-800'
      case 'torneo':
        return 'bg-green-100 text-green-800'
      case 'amichevole':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  },

  isUpcoming(data: string): boolean {
    const today = new Date()
    const matchDate = new Date(data)
    return matchDate >= today
  },

  getAvversarioDisplay(partita: Partita): string {
    // Se abbiamo i dati della nuova struttura, usali
    if (partita.categorie_avversari?.avversari?.nome_societa) {
      return `${partita.categorie_avversari.avversari.nome_societa} ${partita.categorie_avversari.nome_categoria}`
    }
    // Altrimenti usa il campo vecchio per compatibilità
    return partita.avversario || 'Avversario non specificato'
  },

  /**
   * Calcola statistiche per le partite
   */
  calculateStats(partite: Partita[]): {
    prossimi7Giorni: number
    campionato: number
    coppa: number
    torneo: number
    amichevole: number
  } {
    const stats = {
      prossimi7Giorni: 0,
      campionato: 0,
      coppa: 0,
      torneo: 0,
      amichevole: 0
    }

    partite.forEach(partita => {
      // Count matches in next 7 days
      const days = Math.ceil((new Date(partita.data).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
      if (days <= 7 && days >= 0) {
        stats.prossimi7Giorni++
      }

      // Count by competition type
      const tipo = partita.tipo_competizione.toLowerCase()
      if (tipo === 'campionato') {
        stats.campionato++
      } else if (tipo === 'coppa') {
        stats.coppa++
      } else if (tipo === 'torneo') {
        stats.torneo++
      } else if (tipo === 'amichevole') {
        stats.amichevole++
      }
    })

    return stats
  }
}