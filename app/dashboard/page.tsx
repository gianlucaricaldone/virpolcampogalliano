'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTestRole } from '@/contexts/TestRoleContext'
import { 
  Users, 
  Calendar, 
  Trophy, 
  Package, 
  TrendingUp,
  AlertCircle
} from 'lucide-react'

export default function DashboardPage() {
  const { profile, loading } = useAuth()
  const { testRole, isInTestMode } = useTestRole()
  const [stats, setStats] = useState({
    squadre: 0,
    tesserati: 0,
    partite: 0,
    presenze: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const supabase = createClient()

  const loadStats = useCallback(async () => {
    try {
      // Load squadre count
      const { count: squadreCount } = await supabase
        .from('squadre')
        .select('*', { count: 'exact', head: true })

      // Load tesserati count
      const { count: tesseratiCount } = await supabase
        .from('tesserati')
        .select('*', { count: 'exact', head: true })

      // Load partite this week
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const { count: partiteCount } = await supabase
        .from('partite')
        .select('*', { count: 'exact', head: true })
        .gte('data', weekStart.toISOString().split('T')[0])
        .lte('data', weekEnd.toISOString().split('T')[0])

      // Load today's presences
      const today = new Date().toISOString().split('T')[0]
      const { count: presenzeCount } = await supabase
        .from('presenze')
        .select('*', { count: 'exact', head: true })
        .eq('data', today)
        .eq('presente', true)

      setStats({
        squadre: squadreCount || 0,
        tesserati: tesseratiCount || 0,
        partite: partiteCount || 0,
        presenze: presenzeCount || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [supabase])

  useEffect(() => {
    if (profile?.id) {
      loadStats()
    }
  }, [profile?.id, loadStats]) // Dipendi solo dall'ID invece dell'intero oggetto profile

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
      roles: ['admin', 'dirigente']
    },
    {
      title: 'Tesserati',
      description: 'Totale atleti iscritti',
      value: loadingStats ? '...' : stats.tesserati.toString(),
      icon: Users,
      color: 'text-green-600',
      roles: ['admin', 'dirigente']
    },
    {
      title: 'Partite Settimana',
      description: 'Prossimi match',
      value: loadingStats ? '...' : stats.partite.toString(),
      icon: Trophy,
      color: 'text-purple-600',
      roles: ['admin', 'dirigente', 'allenatore']
    },
    {
      title: 'Presenze Oggi',
      description: 'Atleti presenti oggi',
      value: loadingStats ? '...' : stats.presenze.toString(),
      icon: TrendingUp,
      color: 'text-orange-600',
      roles: ['admin', 'dirigente', 'allenatore']
    },
    {
      title: 'Materiale',
      description: 'Articoli in magazzino',
      value: '245',
      icon: Package,
      color: 'text-indigo-600',
      roles: ['admin', 'dirigente']
    },
    {
      title: 'Scadenze',
      description: 'Certificati in scadenza',
      value: '3',
      icon: AlertCircle,
      color: 'text-red-600',
      roles: ['admin', 'dirigente']
    }
  ]

  const filteredCards = dashboardCards.filter(card => 
    card.roles.includes(profile.role)
  )

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

      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getWelcomeMessage()}
        </h1>
        <p className="mt-2 text-gray-600">
          {roleContent.description}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
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
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Presenze registrate per allenamento U15</p>
                <p className="text-xs text-gray-500">2 minuti fa</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Nuova partita programmata vs Real Campogalliano</p>
                <p className="text-xs text-gray-500">15 minuti fa</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Campo 1 prenotato per domani ore 16:00</p>
                <p className="text-xs text-gray-500">1 ora fa</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}