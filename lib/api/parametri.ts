/**
 * API layer centralizzato per Parametri Sistema
 * Ottimizzazioni: query unificate, caching, error handling consistente
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type StagioneSportiva = Database['public']['Tables']['stagioni_sportive']['Row']
type ParametroSistema = Database['public']['Tables']['parametri_sistema']['Row']

interface StagioniAndParametri {
  stagioni: StagioneSportiva[]
  parametri: ParametroSistema[]
  stagioneCorrente: StagioneSportiva | null
}

export const parametriApi = {
  /**
   * Ottimizzazione: singola funzione che recupera stagioni, parametri e stagione corrente
   * Riduce da 2+ query separate a 2 query coordinate
   */
  async getStagioniAndParametri(): Promise<StagioniAndParametri> {
    const supabase = createClient()
    
    try {
      console.log('[ParametriAPI] Fetching stagioni and parametri')
      
      // Parallel queries per massimizzare performance
      const [stagioniResult, parametriResult] = await Promise.all([
        // Query stagioni
        supabase
          .from('stagioni_sportive')
          .select('*')
          .order('data_inizio', { ascending: false }),
        
        // Query parametri sistema
        supabase
          .from('parametri_sistema')
          .select('*')
          .order('chiave', { ascending: true })
      ])

      if (stagioniResult.error) throw stagioniResult.error
      if (parametriResult.error) throw parametriResult.error

      const stagioni = stagioniResult.data || []
      const parametri = parametriResult.data || []

      // Trova la stagione corrente dai parametri
      const stagioneCorrenteParam = parametri.find(p => p.chiave === 'stagione_corrente_id')
      const stagioneCorrente = stagioneCorrenteParam?.valore 
        ? stagioni.find(s => s.id === stagioneCorrenteParam.valore) || null
        : null

      console.log('[ParametriAPI] Successfully fetched', stagioni.length, 'stagioni,', parametri.length, 'parametri')
      
      return {
        stagioni,
        parametri,
        stagioneCorrente
      }
      
    } catch (error) {
      console.error('[ParametriAPI] Error fetching stagioni and parametri:', error)
      throw error
    }
  },

  /**
   * Aggiorna un parametro sistema
   */
  async updateParametro(id: string, nuovoValore: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[ParametriAPI] Updating parametro:', id, 'with value:', nuovoValore)
      
      const { error } = await supabase
        .from('parametri_sistema')
        .update({ valore: nuovoValore })
        .eq('id', id)

      if (error) throw error
      
      console.log('[ParametriAPI] Successfully updated parametro')
    } catch (error) {
      console.error('[ParametriAPI] Error updating parametro:', error)
      throw error
    }
  },

  /**
   * Imposta la stagione corrente
   */
  async setStagioneCorrente(stagioneId: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[ParametriAPI] Setting stagione corrente:', stagioneId)
      
      // Parallel operations per performance
      await Promise.all([
        // Disattiva tutte le stagioni
        supabase
          .from('stagioni_sportive')
          .update({ attiva: false })
          .neq('id', '00000000-0000-0000-0000-000000000000'), // dummy condition

        // Aggiorna il parametro sistema
        supabase
          .from('parametri_sistema')
          .update({ valore: stagioneId })
          .eq('chiave', 'stagione_corrente_id')
      ])

      // Attiva la stagione selezionata
      const { error } = await supabase
        .from('stagioni_sportive')
        .update({ attiva: true })
        .eq('id', stagioneId)

      if (error) throw error
      
      console.log('[ParametriAPI] Successfully set stagione corrente')
    } catch (error) {
      console.error('[ParametriAPI] Error setting stagione corrente:', error)
      throw error
    }
  },

  /**
   * Crea una nuova stagione sportiva
   */
  async createStagione(stagioneData: Omit<Database['public']['Tables']['stagioni_sportive']['Insert'], 'id' | 'created_at' | 'updated_at'>): Promise<Database['public']['Tables']['stagioni_sportive']['Row']> {
    const supabase = createClient()

    try {
      console.log('[ParametriAPI] Creating new stagione')
      
      const { data, error } = await supabase
        .from('stagioni_sportive')
        .insert(stagioneData)
        .select()
        .single()

      if (error) throw error
      
      console.log('[ParametriAPI] Successfully created stagione:', data.id)
      return data
    } catch (error) {
      console.error('[ParametriAPI] Error creating stagione:', error)
      throw error
    }
  },

  /**
   * Archivia una stagione
   */
  async archiveStagione(stagioneId: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[ParametriAPI] Archiving stagione:', stagioneId)
      
      const { error } = await supabase
        .from('stagioni_sportive')
        .update({ attiva: false })
        .eq('id', stagioneId)

      if (error) throw error
      
      console.log('[ParametriAPI] Successfully archived stagione')
    } catch (error) {
      console.error('[ParametriAPI] Error archiving stagione:', error)
      throw error
    }
  },

  /**
   * Ripristina una stagione archiviata
   */
  async ripristinaStagione(stagioneId: string): Promise<void> {
    const supabase = createClient()

    try {
      console.log('[ParametriAPI] Restoring stagione:', stagioneId)
      
      const { error } = await supabase
        .from('stagioni_sportive')
        .update({ attiva: true })
        .eq('id', stagioneId)

      if (error) throw error
      
      console.log('[ParametriAPI] Successfully restored stagione')
    } catch (error) {
      console.error('[ParametriAPI] Error restoring stagione:', error)
      throw error
    }
  },

  /**
   * Verifica se esiste il parametro quota stagionale, altrimenti lo crea
   */
  async ensureQuotaStagionaleExists(): Promise<void> {
    const supabase = createClient()

    try {
      // Controlla se il parametro esiste già
      const { data: existing } = await supabase
        .from('parametri_sistema')
        .select('id')
        .eq('chiave', 'quota_stagionale')
        .single()

      if (!existing) {
        console.log('[ParametriAPI] Creating quota_stagionale parameter')
        
        const { error } = await supabase
          .from('parametri_sistema')
          .insert({
            chiave: 'quota_stagionale',
            valore: '0',
            tipo: 'number',
            descrizione: 'Quota stagionale in euro per ogni tesserato'
          })

        if (error) throw error
        
        console.log('[ParametriAPI] Successfully created quota_stagionale parameter')
      }
    } catch (error) {
      console.error('[ParametriAPI] Error ensuring quota_stagionale exists:', error)
      throw error
    }
  }
}