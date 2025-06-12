'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TestRoleProvider, useTestRole } from '@/contexts/TestRoleContext'
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
  Building
} from 'lucide-react'

function DashboardContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { testRole, setTestRole } = useTestRole()
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()

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
    { name: 'Squadre', href: '/dashboard/squadre', icon: Users, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Tesserati', href: '/dashboard/tesserati', icon: Users, roles: ['admin', 'dirigente'] },
    { name: 'Presenze', href: '/dashboard/presenze', icon: ClipboardList, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Partite', href: '/dashboard/partite', icon: Trophy, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Avversari', href: '/dashboard/avversari', icon: Building, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Report Mensili', href: '/dashboard/report', icon: FileText, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Calendario Campi', href: '/dashboard/campi', icon: Calendar, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Magazzino', href: '/dashboard/magazzino', icon: Package, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Economia', href: '/dashboard/admin/economia', icon: DollarSign, roles: ['admin'] },
    { name: 'Gestione Utenti', href: '/dashboard/admin/utenti', icon: Settings, roles: ['admin'] },
  ]

  // Use test role if admin is testing, otherwise use actual roles
  const currentRoles = profile?.roles && profile.roles.length > 0 ? profile.roles : [profile?.role].filter(Boolean)
  const currentRole = profile?.role // Mantieni per compatibilità UI
  const effectiveRoles = profile?.role === 'admin' && testRole ? [testRole] : currentRoles

  const filteredNavigation = navigation.filter(item => 
    effectiveRoles.some(role => item.roles.includes(role))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-blue-600">
            <h1 className="text-white font-bold text-lg">Virpol</h1>
          </div>
          
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

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
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
      <div className="ml-64">
        <main className="p-8">
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
      <DashboardContent>{children}</DashboardContent>
    </TestRoleProvider>
  )
}