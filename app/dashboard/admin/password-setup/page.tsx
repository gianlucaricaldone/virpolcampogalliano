'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Key, User, Mail, Shield, AlertCircle } from 'lucide-react'

interface UserAuth {
  id: string
  email: string
  nome: string
  cognome: string
  role: string
  auth_method: 'password_set' | 'magic_link_only'
  created_at: string
  last_sign_in_at: string | null
}

export default function PasswordSetupPage() {
  const { profile } = useAuth()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserAuth[]>([])
  const [selectedUser, setSelectedUser] = useState<UserAuth | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

  // Solo admin possono accedere
  useEffect(() => {
    console.log('Password setup - profile check:', { profile, role: profile?.role })
    if (profile && profile.role !== 'admin') {
      console.log('Not admin, redirecting...')
      window.location.href = '/dashboard'
    }
  }, [profile])

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers()
    }
  }, [profile])

  const fetchUsers = async () => {
    console.log('fetchUsers called')
    try {
      // Prima ottieni gli utenti dalla tabella public.users
      console.log('Making query to users table...')
      const { data: publicUsers, error: publicError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          nome,
          cognome,
          role,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (publicError) throw publicError
      
      console.log('Public users found:', publicUsers?.length || 0)
      
      // Poi ottieni la lista degli utenti auth per verificare chi ha già una password
      const authResponse = await fetch('/api/admin/list-auth-users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      let authUsers: any[] = []
      if (authResponse.ok) {
        const authData = await authResponse.json()
        authUsers = authData.users || []
        console.log('Auth users found:', authUsers.length)
      }
      
      // Combina le informazioni
      const usersWithAuthStatus = (publicUsers || []).map(user => {
        // Trova l'utente auth corrispondente
        const authUser = authUsers.find(au => 
          au.id === user.id || 
          au.email?.toLowerCase() === user.email?.toLowerCase()
        )
        
        // Se l'utente pubblico non ha email ma l'utente auth sì, usa quella
        const email = user.email || authUser?.email || null
        
        return {
          ...user,
          email,
          auth_method: authUser?.identities?.some((i: any) => i.provider === 'email') 
            ? 'password_set' as const 
            : 'magic_link_only' as const,
          last_sign_in_at: authUser?.last_sign_in_at || null
        }
      })
      
      console.log('Users processed:', usersWithAuthStatus.length)
      setUsers(usersWithAuthStatus)
    } catch (error) {
      console.error('Errore nel caricamento utenti:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateTempPassword = (user: UserAuth) => {
    const nome = user.nome?.toLowerCase() || 'user'
    const cognome = user.cognome?.toLowerCase() || '2024'
    return `${nome}${cognome}`
  }

  const openPasswordModal = (user: UserAuth) => {
    setSelectedUser(user)
    setTempPassword(generateTempPassword(user))
    setShowModal(true)
    setMessage('')
  }

  const updateUserPassword = async () => {
    if (!selectedUser || !tempPassword) return

    setUpdating(true)
    setMessage('')

    try {
      console.log('Updating password for user:', { 
        userId: selectedUser.id, 
        email: selectedUser.email,
        nome: selectedUser.nome,
        cognome: selectedUser.cognome 
      })
      
      // Chiama l'API route per aggiornare la password
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          email: selectedUser.email,
          password: tempPassword
        })
      })

      const result = await response.json()

      if (!response.ok) {
        // Se l'API fallisce, mostra le istruzioni SQL come fallback
        if (response.status === 500 || result.error?.includes('service_role')) {
          const sqlCommand = `
-- Eseguire questo comando nel SQL Editor di Supabase:
UPDATE auth.users 
SET encrypted_password = crypt('${tempPassword}', gen_salt('bf'))
WHERE email = '${selectedUser.email}';
          `.trim()

          // Copia negli appunti se possibile
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(sqlCommand)
            setMessage('⚠️ API non disponibile. Comando SQL copiato negli appunti! Eseguilo nel SQL Editor di Supabase.')
          } else {
            setMessage('⚠️ API non disponibile. Copia questo comando e eseguilo nel SQL Editor di Supabase:\n\n' + sqlCommand)
          }
        } else {
          throw new Error(result.error || 'Errore nell\'aggiornamento della password')
        }
      } else {
        if (result.data?.email && !selectedUser.email) {
          setMessage(`✅ Account creato e password impostata con successo per ${selectedUser.nome} ${selectedUser.cognome}!\n\nL'utente ora può accedere con:\nEmail: ${result.data.email}\nPassword: ${tempPassword}`)
        } else {
          setMessage(`✅ Password impostata con successo per ${selectedUser.nome} ${selectedUser.cognome}!`)
        }
        
        // Aggiorna lo stato locale dell'utente
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === selectedUser.id 
              ? { ...u, auth_method: 'password_set' as const }
              : u
          )
        )
        
        // Chiudi il modal dopo 2 secondi
        setTimeout(() => {
          setShowModal(false)
          setMessage('')
          setTempPassword('')
        }, 2000)
      }

    } catch (error: any) {
      setMessage('❌ Errore: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const getAuthBadge = (method: string) => {
    if (method === 'password_set') {
      return <Badge className="bg-green-100 text-green-800"><Key className="w-3 h-3 mr-1" />Password OK</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800"><Mail className="w-3 h-3 mr-1" />Solo Email</Badge>
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      dirigente: 'bg-blue-100 text-blue-800',
      allenatore: 'bg-green-100 text-green-800',
      tesserato: 'bg-gray-100 text-gray-800',
      genitore: 'bg-purple-100 text-purple-800'
    }
    return <Badge className={colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{role}</Badge>
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Accesso non autorizzato</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Caricamento utenti...</p>
        </div>
      </div>
    )
  }

  const usersWithoutPassword = users.filter(u => u.auth_method === 'magic_link_only')
  const usersWithPassword = users.filter(u => u.auth_method === 'password_set')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestione Password Utenti</h1>
        <p className="mt-2 text-gray-600">
          Configura l'autenticazione con password per risolvere i problemi di login su mobile
        </p>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Totale Utenti</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Con Password</p>
                <p className="text-2xl font-bold text-green-600">{usersWithPassword.length}</p>
              </div>
              <Key className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Solo Magic Link</p>
                <p className="text-2xl font-bold text-yellow-600">{usersWithoutPassword.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avviso per problemi mobile */}
      {usersWithoutPassword.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Problemi di Login Mobile</h3>
                <p className="text-yellow-700 mt-1">
                  Gli utenti con solo Magic Link potrebbero avere problemi di accesso su dispositivi mobili. 
                  Imposta una password temporanea per garantire un accesso più affidabile.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Avviso per email mancanti */}
      {users.some(u => !u.email) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800">Email Mancanti</h3>
                <p className="text-red-700 mt-1">
                  Alcuni utenti non hanno l'email sincronizzata. Esegui questa query SQL nel pannello Supabase:
                </p>
                <pre className="mt-2 p-3 bg-red-100 rounded text-sm overflow-x-auto">
{`-- Prima sincronizza le email da auth.users
UPDATE public.users u
SET email = au.email, updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR u.email = '')
  AND au.email IS NOT NULL;

-- Poi genera email temporanee per utenti senza corrispondenza in auth
UPDATE public.users
SET email = LOWER(CONCAT(
    COALESCE(REPLACE(nome, ' ', ''), 'utente'),
    '.',
    COALESCE(REPLACE(cognome, ' ', ''), CAST(id AS VARCHAR(8))),
    '@temp.local'
)),
updated_at = NOW()
WHERE email IS NULL OR email = '';`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista utenti */}
      <Card>
        <CardHeader>
          <CardTitle>Utenti del Sistema</CardTitle>
          <CardDescription>
            Gestisci l'autenticazione per ogni utente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="font-medium">{user.cognome} {user.nome}</div>
                    <div className="text-sm text-gray-500">
                      {user.email || (
                        <span className="text-red-500 italic">Email mancante</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {getRoleBadge(user.role)}
                    {getAuthBadge(user.auth_method)}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right text-sm text-gray-500">
                    {user.last_sign_in_at ? (
                      <div>Ultimo accesso: {new Date(user.last_sign_in_at).toLocaleDateString()}</div>
                    ) : (
                      <div>Mai effettuato l'accesso</div>
                    )}
                  </div>
                  {user.auth_method === 'magic_link_only' && user.email && (
                    <Button
                      onClick={() => openPasswordModal(user)}
                      size="sm"
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Imposta Password
                    </Button>
                  )}
                  {!user.email && (
                    <span className="text-sm text-red-600">
                      Richiede sincronizzazione
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Impostazione Password */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imposta Password Temporanea</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Utente:</p>
                <p className="font-medium">{selectedUser.cognome} {selectedUser.nome}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password Temporanea</label>
                <input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Inserisci password temporanea"
                />
                <p className="text-sm text-gray-500 mt-1">
                  L'utente potrà cambiarla dopo il primo accesso
                </p>
              </div>

              {message && (
                <div className={`p-3 border rounded-md ${
                  message.includes('✅') 
                    ? 'bg-green-50 border-green-200' 
                    : message.includes('❌')
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <pre className={`text-sm whitespace-pre-wrap ${
                    message.includes('✅') 
                      ? 'text-green-800' 
                      : message.includes('❌')
                      ? 'text-red-800'
                      : 'text-blue-800'
                  }`}>{message}</pre>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={updateUserPassword}
                  disabled={updating || !tempPassword}
                >
                  {updating ? 'Impostazione...' : 'Imposta Password'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Chiudi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}