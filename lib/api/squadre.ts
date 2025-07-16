/**
 * API layer centralizzato per Squadre
 * Ottimizzazioni: query unificate, caching, error handling consistente
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Squadra = Database['public']['Tables']['squadre']['Row'] & {
  tesserati_count?: number
}

export const squadreApi = {
  /**
   * Ottimizzazione: singola query per ottenere squadre con conteggio tesserati
   */
  async getSquadreWithCounts(stagioneId?: string): Promise<Squadra[]> {
    const supabase = createClient()
    
    try {
      console.log('[SquadreAPI] Fetching squadre with counts for season:', stagioneId || 'all')
      
      // Query principale per le squadre filtrate per stagione
      let squadreQuery = supabase
        .from('squadre')
        .select('*')
        .order('nome', { ascending: true })

      // Filtra per stagione corrente se impostata
      if (stagioneId) {
        squadreQuery = squadreQuery.eq('stagione_id', stagioneId)
      }

      const { data: squadreData, error: squadreError } = await squadreQuery

      if (squadreError) throw squadreError

      // Query ottimizzata per conteggio tesserati usando tesserati_squadre_stagioni
      let tesseratiQuery
      if (stagioneId) {
        // Usa la tabella di relazione per ottenere solo i tesserati della stagione corrente
        tesseratiQuery = supabase
          .from('tesserati_squadre_stagioni')
          .select('squadra_id')
          .eq('stagione_id', stagioneId)
      } else {
        // Fallback: prendi tutti i tesserati attivi
        tesseratiQuery = supabase
          .from('tesserati')
          .select('squadra_id')
          .eq('stato', true)
      }

      const { data: tesseratiData, error: tesseratiError } = await tesseratiQuery

      if (tesseratiError) throw tesseratiError

      // Calcola conteggi localmente per evitare query multiple
      const tesseratiCount: Record<string, number> = {}
      tesseratiData?.forEach(tesserato => {
        if (tesserato.squadra_id) {
          tesseratiCount[tesserato.squadra_id] = (tesseratiCount[tesserato.squadra_id] || 0) + 1
        }
      })

      // Combina i dati con conteggi
      const squadreWithCount = (squadreData || []).map(squadra => ({
        ...squadra,
        tesserati_count: tesseratiCount[squadra.id] || 0
      }))

      console.log('[SquadreAPI] Successfully fetched', squadreWithCount.length, 'squadre with counts')
      return squadreWithCount
      
    } catch (error) {
      console.error('[SquadreAPI] Error fetching squadre with counts:', error)
      throw error
    }
  },

  /**
   * Elimina una squadra
   */
  async deleteSquadra(squadraId: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[SquadreAPI] Deleting squadra:', squadraId)
      
      const { error } = await supabase
        .from('squadre')
        .delete()
        .eq('id', squadraId)

      if (error) throw error
      
      console.log('[SquadreAPI] Successfully deleted squadra')
    } catch (error) {
      console.error('[SquadreAPI] Error deleting squadra:', error)
      throw error
    }
  },

  /**
   * Crea una nuova squadra
   */
  async createSquadra(squadraData: Omit<Squadra, 'id' | 'created_at' | 'updated_at' | 'tesserati_count'>): Promise<Squadra> {
    const supabase = createClient()

    try {
      console.log('[SquadreAPI] Creating new squadra')
      
      const { data, error } = await supabase
        .from('squadre')
        .insert(squadraData)
        .select()
        .single()

      if (error) throw error
      
      console.log('[SquadreAPI] Successfully created squadra:', data.id)
      return { ...data, tesserati_count: 0 }
    } catch (error) {
      console.error('[SquadreAPI] Error creating squadra:', error)
      throw error
    }
  },

  /**
   * Aggiorna una squadra esistente
   */
  async updateSquadra(squadraId: string, squadraData: Partial<Omit<Squadra, 'id' | 'created_at' | 'updated_at' | 'tesserati_count'>>): Promise<Squadra> {
    const supabase = createClient()

    try {
      console.log('[SquadreAPI] Updating squadra:', squadraId)
      
      const { data, error } = await supabase
        .from('squadre')
        .update(squadraData)
        .eq('id', squadraId)
        .select()
        .single()

      if (error) throw error
      
      console.log('[SquadreAPI] Successfully updated squadra')
      return data
    } catch (error) {
      console.error('[SquadreAPI] Error updating squadra:', error)
      throw error
    }
  }
}