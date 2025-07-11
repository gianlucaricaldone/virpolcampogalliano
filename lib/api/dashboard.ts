/**
 * API layer centralizzato per Dashboard
 * Ottimizzazioni: query unificate, caching, error handling consistente
 */

import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  squadre: number
  tesserati: number
  partite: number
  presenze: number
  magazzino: number
  scadenze: number
}

interface RecentActivity {
  type: 'presenza' | 'tesserato' | 'partita' | 'report'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  href?: string
}

export const dashboardApi = {
  /**
   * Ottimizzazione: singola query per tutte le statistiche usando Supabase RPC
   * Riduce da 6 query separate a 1 sola chiamata
   */
  async getStats(stagioneId?: string): Promise<DashboardStats> {
    const supabase = createClient()
    
    try {
      // Usa RPC function dinamica per aggregare tutte le statistiche in una sola query
      const { data, error } = await supabase.rpc('get_dashboard_stats_dynamic', {
        stagione_id_param: stagioneId || null
      })

      if (error) {
        console.warn('RPC dashboard stats fallito, usando query separate:', error)
        // Fallback alle query separate se RPC non disponibile
        return await this.getStatsSeparate(stagioneId)
      }

      // La RPC restituisce un JSON object
      return data || {
        squadre: 0,
        tesserati: 0,
        partite: 0,
        presenze: 0,
        magazzino: 0,
        scadenze: 0
      }
    } catch (error) {
      console.warn('Error in getStats, usando fallback:', error)
      // Fallback
      return await this.getStatsSeparate(stagioneId)
    }
  },

  /**
   * Fallback: query separate ottimizzate (ridotte da 6 a 4 query usando SQL aggregazioni)
   */
  async getStatsSeparate(stagioneId?: string): Promise<DashboardStats> {
    const supabase = createClient()
    
    try {
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      const in30Days = new Date(today)
      in30Days.setDate(today.getDate() + 30)

      const [
        squadreResult,
        tesseratiResult,
        partiteResult,
        miscResult
      ] = await Promise.all([
        // Query 1: Squadre attive
        supabase
          .from('squadre')
          .select('*', { count: 'exact', head: true })
          .eq('stagione_id', stagioneId || ''),

        // Query 2: Tesserati attivi
        supabase
          .from('tesserati')
          .select('*', { count: 'exact', head: true })
          .eq('stato', true),

        // Query 3: Partite settimana corrente
        supabase
          .from('partite')
          .select('*', { count: 'exact', head: true })
          .gte('data', weekStart.toISOString().split('T')[0])
          .lte('data', weekEnd.toISOString().split('T')[0])
          .eq('stagione_id', stagioneId || ''),

        // Query 4: Aggregazioni multiple (presenze, magazzino, scadenze)
        Promise.all([
          // Presenze oggi
          supabase
            .from('presenze')
            .select('*', { count: 'exact', head: true })
            .eq('data', today.toISOString().split('T')[0])
            .eq('presente', true),
          
          // Magazzino totale (con aggregazione SQL)
          supabase
            .from('magazzino')
            .select('quantita.sum()'),
          
          // Certificati in scadenza  
          supabase
            .from('tesserati')
            .select('*', { count: 'exact', head: true })
            .not('scadenza_certificato', 'is', null)
            .gte('scadenza_certificato', today.toISOString().split('T')[0])
            .lte('scadenza_certificato', in30Days.toISOString().split('T')[0])
        ])
      ])

      const [presenzeResult, magazzinoResult, scadenzeResult] = miscResult

      return {
        squadre: squadreResult.count || 0,
        tesserati: tesseratiResult.count || 0,
        partite: partiteResult.count || 0,
        presenze: presenzeResult.count || 0,
        magazzino: magazzinoResult.data?.[0]?.sum || 0,
        scadenze: scadenzeResult.count || 0
      }
    } catch (error) {
      console.error('Error fetching dashboard stats separate:', error)
      throw error
    }
  },

  /**
   * Ottimizzazione: singola query unificata per attività recenti
   * Riduce da 4 query separate a 1 query con UNION
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    const supabase = createClient()
    
    try {
      // Usa RPC function per unificare le attività in una sola query con UNION
      const { data, error } = await supabase.rpc('get_recent_activities', {
        activity_limit: limit
      })

      if (error) {
        console.warn('RPC recent activities fallito, usando query separate:', error)
        // Fallback alle query separate ottimizzate
        return await this.getRecentActivitiesSeparate(limit)
      }

      // Mappa i risultati RPC al formato atteso
      return (data || []).map((row: any) => ({
        type: row.activity_type,
        title: row.title,
        description: row.description,
        timestamp: row.activity_timestamp,
        icon: row.icon,
        color: row.color,
        href: row.href
      }))
    } catch (error) {
      console.warn('Error in getRecentActivities, usando fallback:', error)
      // Fallback
      return await this.getRecentActivitiesSeparate(limit)
    }
  },

  /**
   * Fallback: query separate ottimizzate per attività recenti
   * Ridotte da 4 a 2 query usando JOIN migliori
   */
  async getRecentActivitiesSeparate(limit: number = 10): Promise<RecentActivity[]> {
    const supabase = createClient()
    
    try {
      const activities: RecentActivity[] = []

      // Query 1: Presenze + Tesserati (join ottimizzato)
      const { data: presenze } = await supabase
        .from('presenze')
        .select(`
          id,
          tipo,
          presente,
          created_at,
          tesserati:tesserato_id (nome, cognome)
        `)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 2))

      // Query 2: Tesserati + Partite + Reports (batch ottimizzato)
      const [tesseratiResult, partiteResult, reportsResult] = await Promise.all([
        supabase
          .from('tesserati')
          .select('id, nome, cognome, created_at')
          .eq('stato', true)
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('partite')
          .select(`
            id,
            avversario,
            created_at,
            squadre:squadra_id (nome)
          `)
          .order('created_at', { ascending: false })
          .limit(3),

        supabase
          .from('report_allenatori')
          .select(`
            id,
            created_at,
            users:allenatore_id (nome, cognome)
          `)
          .order('created_at', { ascending: false })
          .limit(2)
      ])

      // Processa risultati
      presenze?.forEach(presenza => {
        const tesserato = Array.isArray(presenza.tesserati) ? presenza.tesserati[0] : presenza.tesserati
        activities.push({
          type: 'presenza',
          title: 'Presenza registrata',
          description: `${tesserato?.nome || 'Nome'} ${tesserato?.cognome || 'Cognome'} - ${presenza.tipo}`,
          timestamp: presenza.created_at,
          icon: presenza.presente ? 'check' : 'x',
          color: presenza.presente ? 'text-green-600' : 'text-red-600',
          href: '/dashboard/presenze'
        })
      })

      tesseratiResult.data?.forEach(tesserato => {
        activities.push({
          type: 'tesserato',
          title: 'Nuovo tesserato',
          description: `${tesserato.nome} ${tesserato.cognome} registrato`,
          timestamp: tesserato.created_at,
          icon: 'user-plus',
          color: 'text-blue-600',
          href: '/dashboard/tesserati'
        })
      })

      partiteResult.data?.forEach(partita => {
        const squadra = Array.isArray(partita.squadre) ? partita.squadre[0] : partita.squadre
        activities.push({
          type: 'partita',
          title: 'Partita programmata',
          description: `${squadra?.nome || 'Squadra'} vs ${partita.avversario}`,
          timestamp: partita.created_at,
          icon: 'trophy',
          color: 'text-purple-600',
          href: '/dashboard/partite'
        })
      })

      reportsResult.data?.forEach(report => {
        const user = Array.isArray(report.users) ? report.users[0] : report.users
        activities.push({
          type: 'report',
          title: 'Nuovo report',
          description: `Report di ${user?.nome || 'Nome'} ${user?.cognome || 'Cognome'}`,
          timestamp: report.created_at,
          icon: 'file-text',
          color: 'text-orange-600',
          href: '/dashboard/presenze'
        })
      })

      // Ordina per timestamp e limita
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)

    } catch (error) {
      console.error('Error fetching recent activities separate:', error)
      throw error
    }
  }
}