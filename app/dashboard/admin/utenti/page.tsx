'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Search, Edit, Trash2, Shield, UserPlus, Mail, AlertCircle } from 'lucide-react'
import { Database } from '@/types/database'
import { adminApi } from '@/lib/api/admin'
import AllenatoreForm from '@/components/forms/AllenatoreForm'
import UserEditForm from '@/components/forms/UserEditForm'

type User = Database['public']['Tables']['users']['Row']

interface UserStats {
  admin: number
  dirigente: number
  allenatore: number
  vice_allenatore: number
  tesserato: number
  genitore: number
  withEmail: number
  withoutEmail: number
  total: number
}

const USERS_CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

export default function UtentiPage() {
  const { profile, hasRole } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [userStats, setUserStats] = useState<UserStats>({
    admin: 0, dirigente: 0, allenatore: 0, vice_allenatore: 0,
    tesserato: 0, genitore: 0, withEmail: 0, withoutEmail: 0, total: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllenatoreForm, setShowAllenatoreForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'allenatori'>('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showNewUserForm, setShowNewUserForm] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const supabase = createClient()

  const fetchUsers = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = 'admin_users_and_stats'
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = getCachedQuery<{users: User[], stats: UserStats}>(cacheKey)
      if (cachedData) {
        console.log('[AdminUsers] Using cached users and stats data')
        setUsers(cachedData.users)
        setUserStats(cachedData.stats)
        setLoading(false)
        return
      }
    }

    // Check if already fetching
    if (fetchingRef.current) {
      console.log('[AdminUsers] Already fetching users, skipping duplicate request')
      return
    }

    try {
      fetchingRef.current = true
      setLoading(true)
      console.log('[AdminUsers] Fetching users and stats from API')
      
      // Use optimized API that calculates stats in single pass
      const { users: usersData, stats } = await adminApi.getUsers()
      
      // Cache both users and stats together
      setCachedQuery(cacheKey, { users: usersData, stats }, USERS_CACHE_DURATION)
      console.log('[AdminUsers] Users and stats cached for', USERS_CACHE_DURATION / 1000, 'seconds')
      
      setUsers(usersData)
      setUserStats(stats)
    } catch (error) {
      console.error('[AdminUsers] Error fetching users:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const sendInviteEmail = async (user: User) => {
    try {
      await adminApi.sendInviteEmail(user)
      alert(`Email di invito inviata con successo a ${user.email}`)
    } catch (error) {
      console.error('Error sending invite:', error)
      alert(error instanceof Error ? error.message : 'Errore nell\'invio dell\'email di invito')
    }
  }

  // Use optimized filtering function
  const filteredUsers = adminApi.filterUsers(users, searchTerm, selectedRole, activeTab)

  const allenatori = users.filter(u => 
    u.roles?.includes('allenatore') || u.role === 'allenatore' ||
    u.roles?.includes('vice_allenatore') || u.role === 'vice_allenatore'
  )

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'dirigente':
        return 'bg-purple-100 text-purple-800'
      case 'allenatore':
        return 'bg-blue-100 text-blue-800'
      case 'vice_allenatore':
        return 'bg-cyan-100 text-cyan-800'
      case 'tesserato':
        return 'bg-green-100 text-green-800'
      case 'genitore':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleRoleClick = (role: string) => {
    if (selectedRole === role) {
      setSelectedRole(null) // Deselect if clicking the same role
    } else {
      setSelectedRole(role)
    }
    // Reset tab to 'all' when filtering by role
    setActiveTab('all')
  }

  // Check authorization after all hooks
  if (!hasRole('admin')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-red-500 mb-4">Accesso negato</p>
            <p className="text-gray-500">
              Solo gli amministratori possono accedere a questa sezione
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento utenti...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
          <p className="mt-2 text-gray-600">
            Gestisci gli utenti del sistema e i loro permessi
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowNewUserForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Utente
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setShowAllenatoreForm(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Nuovo Allenatore
          </Button>
        </div>
      </div>

      {/* Search and Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Cerca per nome, cognome o email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex space-x-4 border-b">
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Tutti gli Utenti ({userStats.total})
              </button>
              <button
                onClick={() => setActiveTab('allenatori')}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'allenatori'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Allenatori e Vice ({userStats.allenatore + userStats.vice_allenatore})
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
        {['admin', 'dirigente', 'allenatore', 'vice_allenatore', 'tesserato', 'genitore'].map(role => (
          <Card 
            key={role} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedRole === role ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
            onClick={() => handleRoleClick(role)}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {userStats[role as keyof UserStats] || 0}
                </div>
                <div className={`text-xs px-2 py-1 rounded-full capitalize mt-2 ${getRoleColor(role)}`}>
                  {role.replace('_', ' ')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Email Stats */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userStats.withEmail}
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 mt-2">
                Con Email
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {userStats.withoutEmail}
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 mt-2">
                Senza Email
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {user.nome || 'Nome'} {user.cognome || 'Cognome'}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {user.email}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(user.roles || [user.role]).filter(Boolean).map((role, index) => (
                    <span key={index} className={`text-xs px-2 py-1 rounded-full capitalize ${getRoleColor(role)}`}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Creato:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('it-IT')}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Ultimo aggiornamento:</span>
                  <span className="ml-2 text-gray-600">
                    {new Date(user.updated_at).toLocaleDateString('it-IT')}
                  </span>
                </div>
                
                {user.role === 'allenatore' && user.squadra_id && (
                  <div>
                    <span className="font-medium">Squadre:</span>
                    <span className="ml-2 text-gray-600">
                      {Array.isArray(user.squadra_id) ? user.squadra_id.length : 1} squadra/e
                    </span>
                  </div>
                )}
                
                {user.telefono && (
                  <div>
                    <span className="font-medium">Telefono:</span>
                    <span className="ml-2 text-gray-600">{user.telefono}</span>
                  </div>
                )}
              </div>
              
              {/* Status Email */}
              <div className="mb-3">
                {!user.email ? (
                  <div className="flex items-center text-yellow-600 text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Nessuna email configurata
                  </div>
                ) : (
                  <div className="flex items-center text-green-600 text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    Email configurata
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingUser(user)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifica
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {user.email && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-blue-600 hover:text-blue-700 border-blue-200"
                    onClick={() => sendInviteEmail(user)}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Invia Email di Accesso
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && searchTerm && (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun utente trovato per "{searchTerm}"</p>
          </CardContent>
        </Card>
      )}

      {showAllenatoreForm && (
        <AllenatoreForm
          onClose={() => setShowAllenatoreForm(false)}
          onSuccess={() => {
            fetchUsers(true) // Force refresh after create
            setShowAllenatoreForm(false)
          }}
        />
      )}

      {showNewUserForm && (
        <UserEditForm
          user={null}
          onClose={() => setShowNewUserForm(false)}
          onSuccess={() => {
            fetchUsers(true) // Force refresh after create
            setShowNewUserForm(false)
          }}
        />
      )}

      {editingUser && (
        <UserEditForm
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            fetchUsers(true) // Force refresh after edit
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}