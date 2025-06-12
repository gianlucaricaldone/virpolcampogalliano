'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TestRoleProvider, useTestRole } from '@/contexts/TestRoleContext'
import { SeasonProvider, useSeason } from '@/contexts/SeasonContext'
import { 
  Users, 
  Calendar, 
  Trophy, 
  Package, 
  DollarSign, 
  Settings, 
  LogOut,
  Home,
  ClipboardList,
  UserCog,
  FileText,
  Building,
  AlertTriangle,
  CheckCircle,
  Shield,
  UserCheck,
  PlayCircle,
  MapPin,
  BarChart3,
  Cog,
  Archive,
  Menu,
  X,
  CalendarDays
} from 'lucide-react'

function DashboardContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { testRole, setTestRole } = useTestRole()
  const { user, profile, loading, signOut } = useAuth()
  const { stagioneCorrente, loading: seasonLoading } = useSeason()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Always render the loading state on initial mount to prevent hydration errors
  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Squadre', href: '/dashboard/squadre', icon: Shield, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Tesserati', href: '/dashboard/tesserati', icon: UserCheck, roles: ['admin', 'dirigente'] },
    { name: 'Presenze', href: '/dashboard/presenze', icon: ClipboardList, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Partite', href: '/dashboard/partite', icon: PlayCircle, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Tornei', href: '/dashboard/tornei', icon: Trophy, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Eventi', href: '/dashboard/eventi', icon: CalendarDays, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Avversari', href: '/dashboard/avversari', icon: Building, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Report Mensili', href: '/dashboard/report', icon: BarChart3, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Calendario Campi', href: '/dashboard/campi', icon: MapPin, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Magazzino', href: '/dashboard/magazzino', icon: Package, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Economia', href: '/dashboard/admin/economia', icon: DollarSign, roles: ['admin'] },
    { name: 'Gestione Utenti', href: '/dashboard/admin/utenti', icon: UserCog, roles: ['admin'] },
    { name: 'Parametri', href: '/dashboard/admin/parametri', icon: Cog, roles: ['admin'] },
  ]

  // Use test role if admin is testing, otherwise use actual roles
  const currentRoles = profile?.roles && profile.roles.length > 0 ? profile.roles : [profile?.role].filter(Boolean)
  const currentRole = profile?.role // Mantieni per compatibilità UI
  const effectiveRoles = profile?.role === 'admin' && testRole ? [testRole] : currentRoles

  const filteredNavigation = navigation.filter(item => 
    effectiveRoles.some(role => item.roles.includes(role || ''))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
        <div className="flex items-center justify-between h-16 px-4">
          <h1 className="text-lg font-bold text-blue-600">Virpol</h1>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="hidden lg:flex items-center justify-center h-16 px-4 bg-blue-600">
            <h1 className="text-white font-bold text-lg">Virpol</h1>
          </div>
          <div className="lg:hidden h-16" /> {/* Spacer for mobile */}
          
          {/* User info */}
          <div className="p-4 border-b">
            <div className="text-sm font-medium text-gray-900">
              {profile.nome || 'Utente'} {profile.cognome || ''}
            </div>
            <div className="text-xs space-y-1">
              {testRole && profile.role === 'admin' ? (
                <span className="text-orange-600 capitalize">
                  {testRole} (Test Mode)
                </span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {currentRoles.map((role, index) => (
                    <span key={index} className="text-gray-500 capitalize">
                      {role}{index < currentRoles.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Role Switcher (only for admin) */}
            {profile.role === 'admin' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Test View As:
                </label>
                <select
                  value={testRole || profile.role}
                  onChange={(e) => setTestRole(e.target.value === profile.role ? null : e.target.value)}
                  className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="admin">Admin (Normal)</option>
                  <option value="dirigente">Dirigente</option>
                  <option value="allenatore">Allenatore</option>
                  <option value="tesserato">Tesserato</option>
                  <option value="genitore">Genitore</option>
                </select>
              </div>
            )}
          </div>

          {/* Current Season Display */}
          <div className={`px-4 py-3 border-b ${stagioneCorrente ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="text-xs font-semibold text-gray-700 mb-1">Stagione Corrente</div>
            {seasonLoading ? (
              <div className="text-xs text-gray-500">Caricamento...</div>
            ) : stagioneCorrente ? (
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-bold text-green-800">
                  {stagioneCorrente.nome}
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                <span className="text-xs font-semibold text-orange-800">
                  Non impostata
                </span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t">
            <Button
              onClick={signOut}
              variant="ghost"
              className="w-full justify-start"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Esci
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        <main className="p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TestRoleProvider>
      <SeasonProvider>
        <DashboardContent>{children}</DashboardContent>
      </SeasonProvider>
    </TestRoleProvider>
  )
}