'use client'

import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  Calendar, 
  Trophy, 
  Package, 
  TrendingUp,
  AlertCircle
} from 'lucide-react'

export default function DashboardPage() {
  const { profile } = useAuth()

  if (!profile) return null

  const dashboardCards = [
    {
      title: 'Squadre Attive',
      description: 'Numero squadre registrate',
      value: '8',
      icon: Users,
      color: 'text-blue-600',
      roles: ['admin', 'dirigente']
    },
    {
      title: 'Tesserati',
      description: 'Totale atleti iscritti',
      value: '156',
      icon: Users,
      color: 'text-green-600',
      roles: ['admin', 'dirigente']
    },
    {
      title: 'Partite Settimana',
      description: 'Prossimi match',
      value: '12',
      icon: Trophy,
      color: 'text-purple-600',
      roles: ['admin', 'dirigente', 'allenatore']
    },
    {
      title: 'Presenze Oggi',
      description: 'Allenamenti in corso',
      value: '89%',
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
            { name: 'Gestisci Utenti', href: '/admin/utenti' },
            { name: 'Visualizza Economia', href: '/admin/economia' },
            { name: 'Report Completi', href: '/admin/report' }
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