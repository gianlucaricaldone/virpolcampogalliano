/**
 * API layer per Presenze - Ottimizzazioni bulk operations
 * Risolve query N+1 e implementa batch operations efficienti
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Presenza = Database['public']['Tables']['presenze']['Row'] & {
  tesserati?: { nome: string; cognome: string; squadra_id: string }
}

type TipoAttivita = 'allenamento' | 'partita' | 'torneo' | 'evento'

interface BulkPresenceData {
  tesseratoIds: string[]
  data: string
  tipo: TipoAttivita
  presente: boolean
  squadraId?: string
  stagioneId?: string
}

export const presenzeApi = {
  /**
   * Ottimizzazione: batch operations per presenze multiple
   * Risolve il problema N+1 usando Supabase RPC o upsert batch
   */
  async handleBulkPresence(data: BulkPresenceData): Promise<void> {
    const supabase = createClient()
    
    try {
      // Tentativo 1: Usa RPC function ottimizzata
      const { error: rpcError } = await supabase.rpc('bulk_update_presenze', {
        tesserato_ids: data.tesseratoIds,
        presenza_data: data.data,
        presenza_tipo: data.tipo,
        is_presente: data.presente,
        squadra_id_param: data.squadraId || null,
        stagione_id_param: data.stagioneId || null
      })

      if (!rpcError) {
        return // Success con RPC
      }

      console.warn('RPC fallito, usando upsert batch:', rpcError)
      
      // Tentativo 2: Upsert batch (supportato da Supabase)
      await this.handleBulkPresenceFallback(data)
      
    } catch (error) {
      console.error('Error in handleBulkPresence:', error)
      throw error
    }
  },

  /**
   * Fallback: ottimizzazione con upsert batch invece di loop N+1
   * Riduce da N query a 2 query (1 select + 1 upsert batch)
   */
  async handleBulkPresenceFallback(data: BulkPresenceData): Promise<void> {
    const supabase = createClient()
    
    try {
      // Query 1: Ottieni presenze esistenti per tutti i tesserati in una sola query
      const { data: existingPresences, error: fetchError } = await supabase
        .from('presenze')
        .select('id, tesserato_id')
        .in('tesserato_id', data.tesseratoIds)
        .eq('data', data.data)
        .eq('tipo', data.tipo)

      if (fetchError) throw fetchError

      // Crea mappa per lookup veloce
      const existingMap = new Map(
        existingPresences?.map(p => [p.tesserato_id, p.id]) || []
      )

      // Prepara batch operations
      const toUpdate: { id: string, presente: boolean }[] = []
      const toInsert: any[] = []

      data.tesseratoIds.forEach(tesseratoId => {
        const existingId = existingMap.get(tesseratoId)
        
        if (existingId) {
          // Update esistente
          toUpdate.push({
            id: existingId,
            presente: data.presente
          })
        } else {
          // Insert nuovo
          toInsert.push({
            tesserato_id: tesseratoId,
            data: data.data,
            tipo: data.tipo,
            presente: data.presente,
            squadra_id: data.squadraId || null,
            stagione_id: data.stagioneId || null
          })
        }
      })

      // Query 2a: Batch update (se ci sono record da aggiornare)
      if (toUpdate.length > 0) {
        // Supabase non supporta bulk update, usiamo upsert
        const updateRecords = toUpdate.map(update => ({
          id: update.id,
          presente: update.presente,
          tipo: data.tipo,
          updated_at: new Date().toISOString()
        }))

        const { error: updateError } = await supabase
          .from('presenze')
          .upsert(updateRecords)

        if (updateError) throw updateError
      }

      // Query 2b: Batch insert (se ci sono nuovi record)
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('presenze')
          .insert(toInsert)

        if (insertError) throw insertError
      }

    } catch (error) {
      console.error('Error in handleBulkPresenceFallback:', error)
      throw error
    }
  },

  /**
   * Ottimizzazione: query presenze con join migliorato
   * Riduce query multiple usando select nested
   */
  async getPresenze(
    data: string,
    tipo: TipoAttivita,
    squadraId?: string,
    stagioneId?: string
  ): Promise<Presenza[]> {
    const supabase = createClient()
    
    try {
      let query = supabase
        .from('presenze')
        .select(`
          id,
          tesserato_id,
          data,
          tipo,
          presente,
          note,
          squadra_id,
          stagione_id,
          created_at,
          updated_at,
          tesserati:tesserato_id (
            id,
            nome,
            cognome,
            squadra_id
          )
        `)
        .eq('data', data)
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })

      // Applica filtri condizionali
      if (squadraId && squadraId !== 'all') {
        query = query.eq('squadra_id', squadraId)
      }
      
      if (stagioneId) {
        query = query.eq('stagione_id', stagioneId)
      }

      const { data: presenze, error } = await query

      if (error) throw error
      
      // Fix type mapping for Supabase nested objects
      return (presenze || []).map(presenza => ({
        ...presenza,
        tesserati: Array.isArray(presenza.tesserati) ? presenza.tesserati[0] : presenza.tesserati
      }))
    } catch (error) {
      console.error('Error fetching presenze:', error)
      throw error
    }
  },

  /**
   * Ottimizzazione: eliminazione batch con transazione
   */
  async deleteAllPresences(
    data: string,
    tipo: TipoAttivita,
    squadraId: string,
    stagioneId: string
  ): Promise<number> {
    const supabase = createClient()
    
    try {
      // Query ottimizzata: elimina direttamente con filtri invece di fetch + delete
      const { count, error } = await supabase
        .from('presenze')
        .delete({ count: 'exact' })
        .eq('data', data)
        .eq('tipo', tipo)
        .eq('squadra_id', squadraId)
        .eq('stagione_id', stagioneId)

      if (error) throw error
      
      return count || 0
    } catch (error) {
      console.error('Error deleting all presences:', error)
      throw error
    }
  },

  /**
   * Toggle presenza singola ottimizzato
   */
  async togglePresenza(presenzaId: string, currentStatus: boolean): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('presenze')
        .update({ 
          presente: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', presenzaId)

      if (error) throw error
    } catch (error) {
      console.error('Error toggling presenza:', error)
      throw error
    }
  },

  /**
   * Statistiche presenze ottimizzate
   */
  async getStatistiche(
    squadraId?: string,
    periodo: 'settimanale' | 'mensile' = 'settimanale'
  ): Promise<any[]> {
    const supabase = createClient()
    
    try {
      // Usa view materializzata o RPC per statistiche pre-calcolate
      const { data, error } = await supabase.rpc('get_statistiche_presenze', {
        squadra_id_param: squadraId === 'all' ? null : squadraId,
        periodo_param: periodo
      })

      if (error) {
        console.warn('RPC statistiche fallito, usando query diretta:', error)
        return await this.getStatisticheFallback(squadraId, periodo)
      }

      return data || []
    } catch (error) {
      console.error('Error fetching statistiche:', error)
      return await this.getStatisticheFallback(squadraId, periodo)
    }
  },

  /**
   * Fallback per statistiche con aggregazioni SQL
   */
  async getStatisticheFallback(
    squadraId?: string,
    periodo: 'settimanale' | 'mensile' = 'settimanale'
  ): Promise<any[]> {
    const supabase = createClient()
    
    try {
      // Query aggregata ottimizzata
      let query = supabase
        .from('presenze')
        .select(`
          tesserato_id,
          tesserati:tesserato_id (nome, cognome),
          squadra_id,
          squadre:squadra_id (nome),
          presente
        `)
        .order('created_at', { ascending: false })

      // Filtro temporale
      const now = new Date()
      const filterDate = periodo === 'settimanale' 
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      query = query.gte('data', filterDate.toISOString().split('T')[0])

      // Filtro squadra
      if (squadraId && squadraId !== 'all') {
        query = query.eq('squadra_id', squadraId)
      }

      const { data, error } = await query

      if (error) throw error

      // Aggrega lato client (temporaneo, meglio spostare su RPC)
      const stats = new Map()
      
      data?.forEach(presenza => {
        const key = presenza.tesserato_id
        const tesserato = Array.isArray(presenza.tesserati) ? presenza.tesserati[0] : presenza.tesserati
        const squadra = Array.isArray(presenza.squadre) ? presenza.squadre[0] : presenza.squadre
        
        if (!stats.has(key)) {
          stats.set(key, {
            tesserato_id: key,
            tesserato_nome: `${tesserato?.nome || 'Nome'} ${tesserato?.cognome || 'Cognome'}`,
            squadra_nome: squadra?.nome || 'Squadra',
            presenze: 0,
            totale: 0,
            percentuale: 0
          })
        }
        
        const stat = stats.get(key)
        stat.totale++
        if (presenza.presente) stat.presenze++
        stat.percentuale = Math.round((stat.presenze / stat.totale) * 100)
      })

      return Array.from(stats.values())
        .sort((a, b) => b.percentuale - a.percentuale)
    } catch (error) {
      console.error('Error in getStatisticheFallback:', error)
      throw error
    }
  }
}