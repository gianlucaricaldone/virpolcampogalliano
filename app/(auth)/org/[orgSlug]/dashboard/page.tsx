'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useOrgQueries } from '@/lib/supabase/organization-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Shield, 
  Calendar, 
  Trophy,
  Building2,
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  tesserati: number
  squadre: number
  partite_future: number
}

export default function OrganizationDashboard() {
  const { organization, memberRole, isAdmin, canManage, checkFeature, checkLimit } = useOrganization()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  const orgQueries = useOrgQueries(organization?.id)

  useEffect(() => {
    if (organization) {
      loadDashboardStats()
    }
  }, [organization])

  const loadDashboardStats = async () => {
    try {
      if (orgQueries) {
        const dashboardStats = await orgQueries.getDashboardStats()
        setStats(dashboardStats)
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Organizzazione non trovata</h3>
          <p className="text-gray-500">Verifica di aver selezionato l'organizzazione corretta.</p>
        </div>
      </div>
    )
  }

  const subscriptionStatus = organization.subscription_status
  const isTrialExpiring = organization.trial_ends_at && 
    new Date(organization.trial_ends_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 giorni

  return (
    <div className="space-y-8">
      {/* Header Organization */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              {organization.logo_url ? (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
              <div className="flex items-center space-x-3 mt-1">
                <Badge variant={memberRole === 'owner' ? 'default' : 'secondary'}>
                  {memberRole}
                </Badge>
                <Badge variant={subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                  {organization.subscription_plan} - {subscriptionStatus}
                </Badge>
              </div>
            </div>
          </div>
          
          {canManage && (
            <div className="flex space-x-2">
              <Link href={`/org/${organization.slug}/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Impostazioni
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Alert per trial o subscription */}
      {(subscriptionStatus !== 'active' || isTrialExpiring) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                {subscriptionStatus !== 'active' && (
                  <p className="text-yellow-800 font-medium">
                    Subscription {subscriptionStatus}. Alcune funzionalità potrebbero essere limitate.
                  </p>
                )}
                {isTrialExpiring && (
                  <p className="text-yellow-800 font-medium">
                    Il periodo di prova scade il {new Date(organization.trial_ends_at!).toLocaleDateString('it-IT')}.
                  </p>
                )}
                <Link href={`/org/${organization.slug}/billing`}>
                  <Button variant="link" className="h-auto p-0 text-yellow-700">
                    Gestisci subscription →
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tesserati Attivi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.tesserati || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Limite: {organization.max_tesserati}
              {stats && !checkLimit('tesserati', stats.tesserati) && (
                <span className="text-red-500 ml-1">• Limite raggiunto</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Squadre</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.squadre || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Limite: {organization.max_squadre}
              {stats && !checkLimit('squadre', stats.squadre) && (
                <span className="text-red-500 ml-1">• Limite raggiunto</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partite Future</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.partite_future || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Prossime partite programmate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href={`/org/${organization.slug}/tesserati`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Gestione Tesserati</span>
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci i tesserati dell'organizzazione
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/org/${organization.slug}/squadre`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Squadre</span>
              </CardTitle>
              <CardDescription>
                Configura squadre e composizioni
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/org/${organization.slug}/presenze`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Presenze</span>
              </CardTitle>
              <CardDescription>
                Registra presenze ad allenamenti e partite
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {checkFeature('tournaments') && (
          <Link href={`/org/${organization.slug}/tornei`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Tornei</span>
                </CardTitle>
                <CardDescription>
                  Organizza e gestisci tornei
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {checkFeature('export') && (
          <Link href={`/org/${organization.slug}/report`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Report</span>
                </CardTitle>
                <CardDescription>
                  Analisi e statistiche dettagliate
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {isAdmin && (
          <Link href={`/org/${organization.slug}/admin`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Amministrazione</span>
                </CardTitle>
                <CardDescription>
                  Gestione utenti e configurazioni
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Funzionalità Disponibili</CardTitle>
          <CardDescription>
            Panoramica delle funzionalità abilitate per il piano {organization.subscription_plan}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(organization.features || {}).map(([feature, enabled]) => (
              <div key={feature} className="flex items-center space-x-2">
                {enabled ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className={`text-sm ${enabled ? 'text-green-700' : 'text-gray-500'}`}>
                  {feature.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}