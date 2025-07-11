/**
 * API layer per Tesserati - Ottimizzazioni JOIN e view
 * Elimina mapping JavaScript sostituendolo con JOIN SQL ottimizzati
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type TesseratoConSquadra = Database['public']['Tables']['tesserati']['Row'] & {
  squadra_stagione?: {
    squadra: { nome: string; id: string }
    ruolo_squadra?: string
    numero_maglia?: number
  } | null
  dati_stagionali?: {
    stato_pagamento: string
    note_pagamento?: string | null
    visita_sportiva: boolean
    scadenza_certificato?: string | null
    certificato_medico?: string | null
  } | null
}

export const tesseratiApi = {
  /**
   * Ottimizzazione principale: singola query con JOIN invece di 3 query separate
   * Riduce da 3 query + mapping JS a 1 query SQL ottimizzata
   */
  async getTesseratiCompleti(stagioneId?: string): Promise<TesseratoConSquadra[]> {
    const supabase = createClient()
    
    try {
      if (!stagioneId) {
        // Senza stagione: solo tesserati base
        const { data, error } = await supabase
          .from('tesserati')
          .select('*')
          .order('cognome', { ascending: true })

        if (error) throw error
        
        return data?.map(tesserato => ({
          ...tesserato,
          squadra_stagione: null,
          dati_stagionali: null
        })) || []
      }

      // Con stagione: query unificata con JOIN ottimizzati
      const { data, error } = await supabase
        .from('tesserati')
        .select(`
          *,
          tesserati_squadre_stagioni!left (
            ruolo_squadra,
            numero_maglia,
            squadre:squadra_id (
              id,
              nome
            )
          ),
          tesserati_dati_stagionali!left (
            stato_pagamento,
            note_pagamento,
            visita_sportiva,
            scadenza_certificato,
            certificato_medico
          )
        `)
        .eq('tesserati_squadre_stagioni.stagione_id', stagioneId)
        .eq('tesserati_dati_stagionali.stagione_id', stagioneId)
        .order('cognome', { ascending: true })

      if (error) throw error

      // Mapping minimo necessario (Supabase non supporta nested objects perfetti)
      return data?.map(tesserato => {
        const associazione = Array.isArray(tesserato.tesserati_squadre_stagioni) 
          ? tesserato.tesserati_squadre_stagioni[0] 
          : tesserato.tesserati_squadre_stagioni

        const datiStagionali = Array.isArray(tesserato.tesserati_dati_stagionali)
          ? tesserato.tesserati_dati_stagionali[0]
          : tesserato.tesserati_dati_stagionali

        return {
          ...tesserato, // Mantieni tutti i campi esistenti
          squadra_stagione: associazione && associazione.squadre ? {
            squadra: Array.isArray(associazione.squadre) ? associazione.squadre[0] : associazione.squadre,
            ruolo_squadra: associazione.ruolo_squadra,
            numero_maglia: associazione.numero_maglia
          } : null,
          dati_stagionali: datiStagionali ? {
            stato_pagamento: datiStagionali.stato_pagamento,
            note_pagamento: datiStagionali.note_pagamento,
            visita_sportiva: datiStagionali.visita_sportiva,
            scadenza_certificato: datiStagionali.scadenza_certificato,
            certificato_medico: datiStagionali.certificato_medico
          } : null
        } as TesseratoConSquadra
      }) || []

    } catch (error) {
      console.error('Error fetching tesserati completi:', error)
      throw error
    }
  },

  /**
   * Query ottimizzata per tesserati con filtri avanzati
   * Supporta paginazione server-side per performance
   */
  async getTesseratiPaginated(
    stagioneId?: string,
    filters?: {
      search?: string
      squadraId?: string
      statoPagamento?: string
      visitaSportiva?: string
    },
    pagination?: {
      page: number
      limit: number
    }
  ): Promise<{
    data: TesseratoConSquadra[]
    count: number
    totalPages: number
  }> {
    const supabase = createClient()
    
    try {
      const { page = 1, limit = 20 } = pagination || {}
      const offset = (page - 1) * limit

      // Costruisci query base con filtri
      let query = supabase
        .from('tesserati')
        .select(`
          *,
          tesserati_squadre_stagioni!left (
            ruolo_squadra,
            numero_maglia,
            squadre:squadra_id (id, nome)
          ),
          tesserati_dati_stagionali!left (
            stato_pagamento,
            note_pagamento,
            visita_sportiva,
            scadenza_certificato,
            certificato_medico
          )
        `, { count: 'exact' })

      // Applica filtri
      if (stagioneId) {
        query = query
          .eq('tesserati_squadre_stagioni.stagione_id', stagioneId)
          .eq('tesserati_dati_stagionali.stagione_id', stagioneId)
      }

      if (filters?.search) {
        query = query.or(`
          nome.ilike.%${filters.search}%,
          cognome.ilike.%${filters.search}%,
          codice_fiscale.ilike.%${filters.search}%,
          codice_cartellino.ilike.%${filters.search}%
        `)
      }

      if (filters?.squadraId && filters.squadraId !== '') {
        if (filters.squadraId === 'senza_squadra') {
          query = query.is('tesserati_squadre_stagioni.squadra_id', null)
        } else {
          query = query.eq('tesserati_squadre_stagioni.squadra_id', filters.squadraId)
        }
      }

      if (filters?.statoPagamento) {
        query = query.eq('tesserati_dati_stagionali.stato_pagamento', filters.statoPagamento)
      }

      if (filters?.visitaSportiva) {
        const isVisited = filters.visitaSportiva === 'si'
        query = query.eq('tesserati_dati_stagionali.visita_sportiva', isVisited)
      }

      // Applica paginazione e ordinamento
      const { data, error, count } = await query
        .order('cognome', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) throw error

      const tesserati = await this.mapTesseratiData(data || [])
      const totalPages = Math.ceil((count || 0) / limit)

      return {
        data: tesserati,
        count: count || 0,
        totalPages
      }

    } catch (error) {
      console.error('Error fetching tesserati paginated:', error)
      throw error
    }
  },

  /**
   * Mapping ottimizzato dei dati tesserati
   */
  async mapTesseratiData(rawData: any[]): Promise<TesseratoConSquadra[]> {
    return rawData.map(tesserato => {
      const associazione = Array.isArray(tesserato.tesserati_squadre_stagioni) 
        ? tesserato.tesserati_squadre_stagioni[0] 
        : tesserato.tesserati_squadre_stagioni

      const datiStagionali = Array.isArray(tesserato.tesserati_dati_stagionali)
        ? tesserato.tesserati_dati_stagionali[0]
        : tesserato.tesserati_dati_stagionali

      return {
        ...tesserato, // Include all base fields
        squadra_stagione: associazione && associazione.squadre ? {
          squadra: Array.isArray(associazione.squadre) ? associazione.squadre[0] : associazione.squadre,
          ruolo_squadra: associazione.ruolo_squadra,
          numero_maglia: associazione.numero_maglia
        } : null,
        dati_stagionali: datiStagionali ? {
          stato_pagamento: datiStagionali.stato_pagamento,
          note_pagamento: datiStagionali.note_pagamento,
          visita_sportiva: datiStagionali.visita_sportiva,
          scadenza_certificato: datiStagionali.scadenza_certificato,
          certificato_medico: datiStagionali.certificato_medico
        } : null
      } as TesseratoConSquadra
    })
  },

  /**
   * Operazioni CRUD ottimizzate
   */
  async createTesserato(tesseratoData: any): Promise<string> {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('tesserati')
        .insert(tesseratoData)
        .select('id')
        .single()

      if (error) throw error
      
      return data.id
    } catch (error) {
      console.error('Error creating tesserato:', error)
      throw error
    }
  },

  async updateTesserato(id: string, tesseratoData: any): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('tesserati')
        .update({
          ...tesseratoData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating tesserato:', error)
      throw error
    }
  },

  async deleteTesserato(id: string): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('tesserati')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting tesserato:', error)
      throw error
    }
  },

  /**
   * Utility functions per business logic
   */
  isCertificateExpiring(scadenza: string | null | undefined): boolean {
    if (!scadenza) return false
    const today = new Date()
    const expiry = new Date(scadenza)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  },

  isCertificateExpired(scadenza: string | null | undefined): boolean {
    if (!scadenza) return false
    const today = new Date()
    const expiry = new Date(scadenza)
    return expiry < today
  },

  getStatusColor(stato: string): string {
    switch (stato) {
      case 'pagato':
        return 'bg-green-100 text-green-800'
      case 'in_sospeso':
        return 'bg-yellow-100 text-yellow-800'
      case 'non_pagato':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  },

  /**
   * Ottimizzazione: singola funzione che recupera tesserati e squadre insieme
   * Riduce da 2 chiamate separate a 1 chiamata coordinata
   */
  async getTesseratiAndSquadre(stagioneId?: string): Promise<{
    tesserati: TesseratoConSquadra[]
    squadre: Database['public']['Tables']['squadre']['Row'][]
  }> {
    const supabase = createClient()
    
    try {
      console.log('[TesseratiAPI] Fetching tesserati and squadre for season:', stagioneId || 'all')
      
      // Parallel queries per massimizzare performance
      const [tesseratiResult, squadreResult] = await Promise.all([
        // Usa la funzione esistente ottimizzata per tesserati
        this.getTesseratiCompleti(stagioneId),
        
        // Query squadre filtrata per stagione
        (() => {
          let squadreQuery = supabase
            .from('squadre')
            .select('*')
            .order('nome', { ascending: true })

          if (stagioneId) {
            squadreQuery = squadreQuery.eq('stagione_id', stagioneId)
          }

          return squadreQuery
        })()
      ])

      if (squadreResult.error) throw squadreResult.error

      const result = {
        tesserati: tesseratiResult,
        squadre: squadreResult.data || []
      }

      console.log('[TesseratiAPI] Successfully fetched', result.tesserati.length, 'tesserati and', result.squadre.length, 'squadre')
      
      return result
      
    } catch (error) {
      console.error('[TesseratiAPI] Error fetching tesserati and squadre:', error)
      throw error
    }
  }
}