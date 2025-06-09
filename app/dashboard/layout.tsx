'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Calendar, 
  Trophy, 
  Package, 
  DollarSign, 
  Settings, 
  LogOut,
  Home,
  ClipboardList
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Squadre', href: '/dashboard/squadre', icon: Users, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Tesserati', href: '/dashboard/tesserati', icon: Users, roles: ['admin', 'dirigente'] },
    { name: 'Presenze', href: '/dashboard/presenze', icon: ClipboardList, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Partite', href: '/dashboard/partite', icon: Trophy, roles: ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'] },
    { name: 'Calendario Campi', href: '/dashboard/campi', icon: Calendar, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Magazzino', href: '/dashboard/magazzino', icon: Package, roles: ['admin', 'dirigente', 'allenatore'] },
    { name: 'Economia', href: '/admin/economia', icon: DollarSign, roles: ['admin'] },
    { name: 'Gestione Utenti', href: '/admin/utenti', icon: Settings, roles: ['admin'] },
  ]

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(profile.role)
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
            <div className="text-xs text-gray-500 capitalize">
              {profile.role}
            </div>
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