'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTestRole } from '@/contexts/TestRoleContext'
import { useRouter } from 'next/navigation'
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

export default function DashboardPage() {
  const { profile, loading, hasAnyRole } = useAuth()
  const { stagioneCorrente } = useSeason()
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
  const supabase = createClient()

  const loadStats = useCallback(async () => {
    try {
      // Esegui tutte le query in parallelo per migliori performance
      const [
        squadreResult,
        tesseratiResult,
        partiteResult,
        presenzeResult,
        magazzinoResult,
        scadenzeResult
      ] = await Promise.all([
        // Conta squadre attive per stagione corrente
        (() => {
          let query = supabase
            .from('squadre')
            .select('*', { count: 'exact', head: true })
          
          if (stagioneCorrente?.id) {
            query = query.eq('stagione_id', stagioneCorrente.id)
          }
          
          return query
        })(),

        // Conta tesserati attivi
        supabase
          .from('tesserati')
          .select('*', { count: 'exact', head: true }),

        // Conta partite della settimana corrente
        (() => {
          const today = new Date()
          const weekStart = new Date(today)
          weekStart.setDate(today.getDate() - today.getDay()) // Domenica
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6) // Sabato
          
          let query = supabase
            .from('partite')
            .select('*', { count: 'exact', head: true })
            .gte('data', weekStart.toISOString().split('T')[0])
            .lte('data', weekEnd.toISOString().split('T')[0])
            
          if (stagioneCorrente?.id) {
            query = query.eq('stagione_id', stagioneCorrente.id)
          }
          
          return query
        })(),

        // Conta presenze di oggi
        (() => {
          const today = new Date().toISOString().split('T')[0]
          return supabase
            .from('presenze')
            .select('*', { count: 'exact', head: true })
            .eq('data', today)
            .eq('presente', true)
        })(),

        // Conta articoli in magazzino
        supabase
          .from('magazzino')
          .select('quantita'),

        // Conta certificati in scadenza (prossimi 30 giorni)
        (() => {
          const today = new Date()
          const in30Days = new Date(today)
          in30Days.setDate(today.getDate() + 30)
          
          return supabase
            .from('tesserati')
            .select('scadenza_certificato', { count: 'exact', head: true })
            .not('scadenza_certificato', 'is', null)
            .gte('scadenza_certificato', today.toISOString().split('T')[0])
            .lte('scadenza_certificato', in30Days.toISOString().split('T')[0])
        })()
      ])

      // Calcola totale articoli magazzino
      const magazzinoTotal = magazzinoResult.data?.reduce((sum, item) => sum + (item.quantita || 0), 0) || 0

      setStats({
        squadre: squadreResult.count || 0,
        tesserati: tesseratiResult.count || 0,
        partite: partiteResult.count || 0,
        presenze: presenzeResult.count || 0,
        magazzino: magazzinoTotal,
        scadenze: scadenzeResult.count || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [supabase, stagioneCorrente?.id])

  const loadRecentActivities = useCallback(async () => {
    try {
      const activities: RecentActivity[] = []

      // Ultime 5 presenze registrate
      const { data: presenze } = await supabase
        .from('presenze')
        .select(`
          *,
          tesserati:tesserato_id (nome, cognome)
        `)
        .order('created_at', { ascending: false })
        .limit(3)

      presenze?.forEach(presenza => {
        activities.push({
          type: 'presenza',
          title: `Presenza registrata`,
          description: `${presenza.tesserati?.nome} ${presenza.tesserati?.cognome} - ${presenza.tipo}`,
          timestamp: presenza.created_at,
          icon: presenza.presente ? 'check' : 'x',
          color: presenza.presente ? 'text-green-600' : 'text-red-600',
          href: '/dashboard/presenze'
        })
      })

      // Ultimi 3 tesserati registrati
      const { data: tesserati } = await supabase
        .from('tesserati')
        .select('*')
        .eq('stato', true) // Solo tesserati attivi
        .order('created_at', { ascending: false })
        .limit(2)

      tesserati?.forEach(tesserato => {
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

      // Ultime 3 partite programmate
      const { data: partite } = await supabase
        .from('partite')
        .select(`
          *,
          squadre:squadra_id (nome)
        `)
        .order('created_at', { ascending: false })
        .limit(2)

      partite?.forEach(partita => {
        activities.push({
          type: 'partita',
          title: 'Partita programmata',
          description: `${partita.squadre?.nome} vs ${partita.avversario}`,
          timestamp: partita.created_at,
          icon: 'trophy',
          color: 'text-purple-600',
          href: '/dashboard/partite'
        })
      })

      // Ultimi report allenatori (se esistono)
      const { data: reports } = await supabase
        .from('report_allenatori')
        .select(`
          *,
          users:allenatore_id (nome, cognome)
        `)
        .order('created_at', { ascending: false })
        .limit(2)

      reports?.forEach(report => {
        activities.push({
          type: 'report',
          title: 'Nuovo report',
          description: `Report di ${report.users?.nome} ${report.users?.cognome}`,
          timestamp: report.created_at,
          icon: 'file-text',
          color: 'text-orange-600',
          href: '/dashboard/presenze'
        })
      })

      // Ordina tutte le attività per timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setRecentActivities(activities.slice(0, 10)) // Prendi le prime 10
    } catch (error) {
      console.error('Error loading recent activities:', error)
    } finally {
      setLoadingActivities(false)
    }
  }, [supabase])

  useEffect(() => {
    if (profile?.id) {
      loadStats()
      loadRecentActivities()
    }
  }, [profile?.id, loadStats, loadRecentActivities]) // Dipendi solo dall'ID invece dell'intero oggetto profile

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
      description: 'Numero squadre registrate',
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
      href: '/dashboard/tesserati' // Vai ai tesserati per gestire le scadenze
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

      {/* Season Info */}
      {stagioneCorrente ? (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm font-medium">
              Visualizzando dati per: <span className="font-bold">{stagioneCorrente.nome}</span>
              <span className="text-green-600 ml-2">
                ({new Date(stagioneCorrente.data_inizio).toLocaleDateString('it-IT')} - {new Date(stagioneCorrente.data_fine).toLocaleDateString('it-IT')})
              </span>
            </p>
          </div>
        </div>
      ) : (
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
            setLoadingStats(true)
            setLoadingActivities(true)
            loadStats()
            loadRecentActivities()
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
              <a
                key={action.name}
                href={action.href}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  {action.name}
                </div>
              </a>
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