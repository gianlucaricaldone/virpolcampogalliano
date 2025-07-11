'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { dashboardApi } from '@/lib/api/dashboard'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { CACHE_DURATIONS } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTestRole } from '@/contexts/TestRoleContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Users, 
  Calendar, 
  Trophy, 
  Package, 
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  UserPlus,
  FileText,
  Clock
} from 'lucide-react'

interface RecentActivity {
  type: 'presenza' | 'tesserato' | 'partita' | 'report'
  title: string
  description: string
  timestamp: string
  icon: string
  color: string
  href?: string
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

export default function DashboardPage() {
  const { profile, loading, hasAnyRole } = useAuth()
  const { stagioneCorrente, loading: seasonLoading } = useSeason()
  const { testRole, isInTestMode } = useTestRole()
  const router = useRouter()
  const [stats, setStats] = useState({
    squadre: 0,
    tesserati: 0,
    partite: 0,
    presenze: 0,
    magazzino: 0,
    scadenze: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const statsLoadingRef = useRef(false)
  const activitiesLoadingRef = useRef(false)
  const lastStatsSeasonId = useRef<string | undefined>()
  const initialLoadDone = useRef(false)

  const loadStats = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = `dashboard_stats_${stagioneCorrente?.id || 'all'}`
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedStats = getCachedQuery<typeof stats>(cacheKey)
      if (cachedStats) {
        console.log('[Dashboard] Using cached stats')
        setStats(cachedStats)
        setLoadingStats(false)
        return
      }
    }

    // Check if already loading
    if (statsLoadingRef.current) {
      console.log('[Dashboard] Stats already loading, skipping duplicate request')
      return
    }

    try {
      statsLoadingRef.current = true
      setLoadingStats(true)
      console.log('[Dashboard] Fetching fresh stats from API')
      
      const data = await dashboardApi.getStats(stagioneCorrente?.id)
      
      // Cache the result
      setCachedQuery(cacheKey, data, CACHE_DURATIONS.DASHBOARD_STATS)
      console.log('[Dashboard] Stats cached for', CACHE_DURATIONS.DASHBOARD_STATS / 1000, 'seconds')
      
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
      statsLoadingRef.current = false
    }
  }, [stagioneCorrente?.id])

  const loadRecentActivities = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = 'dashboard_recent_activities'
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedActivities = getCachedQuery<RecentActivity[]>(cacheKey)
      if (cachedActivities) {
        console.log('[Dashboard] Using cached activities')
        setRecentActivities(cachedActivities)
        setLoadingActivities(false)
        return
      }
    }

    // Check if already loading
    if (activitiesLoadingRef.current) {
      console.log('[Dashboard] Activities already loading, skipping duplicate request')
      return
    }

    try {
      activitiesLoadingRef.current = true
      setLoadingActivities(true)
      console.log('[Dashboard] Fetching fresh activities from API')
      
      const data = await dashboardApi.getRecentActivities(10)
      
      // Cache the result
      setCachedQuery(cacheKey, data || [], CACHE_DURATIONS.DASHBOARD_STATS)
      console.log('[Dashboard] Activities cached for', CACHE_DURATIONS.DASHBOARD_STATS / 1000, 'seconds')
      
      setRecentActivities(data || [])
    } catch (error) {
      console.error('Error loading recent activities:', error)
    } finally {
      setLoadingActivities(false)
      activitiesLoadingRef.current = false
    }
  }, [])

  // Separate effect for initial load based on profile
  useEffect(() => {
    if (profile?.id) {
      loadRecentActivities()
    }
  }, [profile?.id])
  
  // Separate effect for stats that depend on stagione
  useEffect(() => {
    // Skip if still loading season data
    if (seasonLoading) {
      console.log('[Dashboard] Season still loading, waiting...')
      return
    }
    
    // Only load stats if profile exists
    if (profile?.id) {
      const currentSeasonId = stagioneCorrente?.id
      
      // Skip if season ID hasn't actually changed
      if (initialLoadDone.current && lastStatsSeasonId.current === currentSeasonId) {
        console.log('[Dashboard] Season ID unchanged, skipping stats reload')
        return
      }
      
      console.log('[Dashboard] Loading stats for season:', currentSeasonId || 'no season')
      lastStatsSeasonId.current = currentSeasonId
      initialLoadDone.current = true
      loadStats()
    }
  }, [profile?.id, stagioneCorrente?.id, seasonLoading, loadStats])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dashboard...</p>
        </div>
      </div>
    )
  }

  const dashboardCards = [
    {
      title: 'Squadre Attive',
      description: 'Squadre della stagione corrente',
      value: loadingStats ? '...' : stats.squadre.toString(),
      icon: Users,
      color: 'text-blue-600',
      roles: ['admin', 'dirigente'],
      href: '/dashboard/squadre'
    },
    {
      title: 'Tesserati',
      description: 'Totale atleti iscritti',
      value: loadingStats ? '...' : stats.tesserati.toString(),
      icon: Users,
      color: 'text-green-600',
      roles: ['admin', 'dirigente'],
      href: '/dashboard/tesserati'
    },
    {
      title: 'Partite Settimana',
      description: 'Match di questa settimana',
      value: loadingStats ? '...' : stats.partite.toString(),
      icon: Trophy,
      color: 'text-purple-600',
      roles: ['admin', 'dirigente', 'allenatore'],
      href: '/dashboard/partite'
    },
    {
      title: 'Presenze Oggi',
      description: 'Atleti presenti oggi',
      value: loadingStats ? '...' : stats.presenze.toString(),
      icon: TrendingUp,
      color: 'text-orange-600',
      roles: ['admin', 'dirigente', 'allenatore'],
      href: '/dashboard/presenze'
    },
    {
      title: 'Materiale',
      description: 'Articoli in magazzino',
      value: loadingStats ? '...' : stats.magazzino.toString(),
      icon: Package,
      color: 'text-indigo-600',
      roles: ['admin', 'dirigente'],
      href: '/dashboard/magazzino'
    },
    {
      title: 'Scadenze',
      description: 'Certificati in scadenza (30gg)',
      value: loadingStats ? '...' : stats.scadenze.toString(),
      icon: AlertCircle,
      color: 'text-red-600',
      roles: ['admin', 'dirigente'],
      href: '/dashboard/tesserati'
    }
  ]

  const filteredCards = dashboardCards.filter(card => 
    hasAnyRole(card.roles)
  )

  // Helper function per le icone delle attività
  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'check':
        return Check
      case 'x':
        return X
      case 'user-plus':
        return UserPlus
      case 'trophy':
        return Trophy
      case 'file-text':
        return FileText
      default:
        return Clock
    }
  }

  // Helper function per formattare il tempo relativo
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const past = new Date(timestamp)
    const diffInMs = now.getTime() - past.getTime()
    const diffInMins = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMins < 1) {
      return 'Adesso'
    } else if (diffInMins < 60) {
      return `${diffInMins} minuti fa`
    } else if (diffInHours < 24) {
      return `${diffInHours} ore fa`
    } else {
      return `${diffInDays} giorni fa`
    }
  }

  const getWelcomeMessage = () => {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera'
    return `${greeting}, ${profile.nome || 'Utente'}!`
  }

  const getRoleSpecificContent = () => {
    switch (profile.role) {
      case 'admin':
        return {
          title: 'Pannello Amministratore',
          description: 'Gestisci tutte le funzionalità della società sportiva',
          quickActions: [
            { name: 'Gestisci Utenti', href: '/dashboard/admin/utenti' },
            { name: 'Visualizza Economia', href: '/dashboard/admin/economia' },
            { name: 'Report Completi', href: '/dashboard/admin/report' }
          ]
        }
      case 'dirigente':
        return {
          title: 'Pannello Dirigente',
          description: 'Supervisiona le attività della società',
          quickActions: [
            { name: 'Gestisci Tesserati', href: '/dashboard/tesserati' },
            { name: 'Controlla Pagamenti', href: '/dashboard/pagamenti' },
            { name: 'Visualizza Magazzino', href: '/dashboard/magazzino' }
          ]
        }
      case 'allenatore':
        return {
          title: 'Pannello Allenatore',
          description: 'Gestisci la tua squadra e gli allenamenti',
          quickActions: [
            { name: 'Registra Presenze', href: '/dashboard/presenze' },
            { name: 'Programma Partite', href: '/dashboard/partite' },
            { name: 'Prenota Campo', href: '/dashboard/campi' }
          ]
        }
      case 'tesserato':
      case 'genitore':
        return {
          title: 'Area Personale',
          description: 'Visualizza le tue informazioni e attività',
          quickActions: [
            { name: 'Le Mie Presenze', href: '/dashboard/presenze' },
            { name: 'Prossime Partite', href: '/dashboard/partite' },
            { name: 'Documenti', href: '/dashboard/documenti' }
          ]
        }
      default:
        return {
          title: 'Dashboard',
          description: 'Benvenuto nel sistema',
          quickActions: []
        }
    }
  }

  const roleContent = getRoleSpecificContent()

  return (
    <div className="space-y-8">
      {/* Test Mode Banner */}
      {isInTestMode && (
        <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                🧪 Modalità Test Attiva: Visualizzando come <span className="font-bold capitalize">{testRole}</span>
              </p>
              <p className="text-xs mt-1">
                Questa è solo una simulazione per l'admin. I dati e i permessi mostrati sono quelli del ruolo {testRole}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Season Info - Solo se non c'è stagione corrente */}
      {!stagioneCorrente && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-sm font-medium">
              Nessuna stagione corrente impostata. Alcuni dati potrebbero non essere filtrati correttamente.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {getWelcomeMessage()}
          </h1>
          <p className="mt-2 text-gray-600">
            {roleContent.description}
          </p>
        </div>
        <button
          onClick={() => {
            loadStats(true)
            loadRecentActivities(true)
          }}
          disabled={loadingStats || loadingActivities}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${(loadingStats || loadingActivities) ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const Icon = card.icon
          return (
            <Card 
              key={card.title} 
              className="hover:shadow-md transition-shadow cursor-pointer hover:scale-105 duration-200"
              onClick={() => router.push(card.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide</CardTitle>
          <CardDescription>
            Accedi rapidamente alle funzionalità principali
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roleContent.quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  {action.name}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Attività Recenti</CardTitle>
          <CardDescription>
            Ultime azioni registrate nel sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingActivities ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity, index) => {
                const IconComponent = getActivityIcon(activity.icon)
                return (
                  <div 
                    key={index} 
                    className={`flex items-center space-x-4 p-2 rounded-lg transition-colors ${
                      activity.href ? 'hover:bg-gray-50 cursor-pointer' : ''
                    }`}
                    onClick={() => activity.href && router.push(activity.href)}
                  >
                    <div className={`p-1 rounded-full ${activity.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                      <IconComponent className={`h-3 w-3 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-gray-600">{activity.description}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nessuna attività recente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}