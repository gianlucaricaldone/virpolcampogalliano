'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Save, User } from 'lucide-react'
import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']
type UserRole = 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'

interface UserEditFormProps {
  user: User | null // null per creare nuovo utente
  onClose: () => void
  onSuccess: () => void
}

export default function UserEditForm({ user, onClose, onSuccess }: UserEditFormProps) {
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(user?.roles || (user?.role ? [user.role] as UserRole[] : ['tesserato']))
  const [nome, setNome] = useState(user?.nome || '')
  const [cognome, setCognome] = useState(user?.cognome || '')
  const [telefono, setTelefono] = useState(user?.telefono || '')
  const [email, setEmail] = useState(user?.email || '')
  const [loading, setLoading] = useState(false)
  const isCreating = !user
  const supabase = createClient()

  const allRoles: { value: UserRole; label: string; description: string }[] = [
    { value: 'admin', label: 'Amministratore', description: 'Accesso completo a tutte le funzionalità' },
    { value: 'dirigente', label: 'Dirigente', description: 'Gestione squadre, tesserati e organizzazione' },
    { value: 'allenatore', label: 'Allenatore', description: 'Gestione presenze, partite e report' },
    { value: 'vice_allenatore', label: 'Vice Allenatore', description: 'Assistenza allenatore, gestione presenze' },
    { value: 'tesserato', label: 'Tesserato', description: 'Accesso base alle proprie informazioni' },
    { value: 'genitore', label: 'Genitore', description: 'Visualizzazione informazioni figli tesserati' }
  ]

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        // Non permettere di rimuovere tutti i ruoli
        if (prev.length === 1) return prev
        return prev.filter(r => r !== role)
      } else {
        return [...prev, role]
      }
    })
  }

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      alert('Un utente deve avere almeno un ruolo')
      return
    }

    if (!nome.trim()) {
      alert('Il nome è obbligatorio')
      return
    }

    if (!cognome.trim()) {
      alert('Il cognome è obbligatorio')
      return
    }

    // Email non più obbligatoria durante la creazione

    setLoading(true)
    try {
      if (isCreating) {
        // Crea solo il profilo utente - il magic link verrà inviato successivamente se necessario
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            email: email.trim() || null,
            roles: selectedRoles,
            role: selectedRoles[0],
            nome: nome.trim(),
            cognome: cognome.trim(),
            telefono: telefono.trim() || null,
            has_logged_in: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (profileError) throw profileError

        alert('Utente creato con successo!')
      } else {
        // Aggiorna utente esistente (inclusa email se modificata)
        const { error } = await supabase
          .from('users')
          .update({ 
            roles: selectedRoles,
            role: selectedRoles[0],
            nome: nome.trim(),
            cognome: cognome.trim(),
            telefono: telefono.trim() || null,
            email: email.trim() || null
          })
          .eq('id', user.id)

        if (error) throw error
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving user:', error)
      alert(`Errore nel ${isCreating ? 'creare' : 'aggiornare'} l'utente`)
    } finally {
      setLoading(false)
    }
  }

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'dirigente':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'allenatore':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'vice_allenatore':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200'
      case 'tesserato':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'genitore':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {isCreating ? 'Nuovo Utente' : 'Modifica Utente'}
              </CardTitle>
              <CardDescription className="mt-2">
                {isCreating ? 'Crea un nuovo utente del sistema' : user.email}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informazioni Personali */}
          <div>
            <h3 className="font-medium mb-4">Informazioni Personali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="inserisci@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isCreating 
                    ? 'Opzionale - può essere aggiunta successivamente per inviare l\'invito di accesso'
                    : 'Modifica l\'email per inviare un nuovo invito di accesso'
                  }
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Inserisci nome"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                  placeholder="Inserisci cognome"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Inserisci numero di telefono (opzionale)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">Ruoli Assegnati</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedRoles.map(role => (
                <span
                  key={role}
                  className={`px-3 py-1 rounded-full text-sm border ${getRoleColor(role)}`}
                >
                  {allRoles.find(r => r.value === role)?.label}
                </span>
              ))}
              {selectedRoles.length === 0 && (
                <span className="text-gray-500 text-sm">Nessun ruolo selezionato</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">Seleziona Ruoli</h3>
            <div className="space-y-3">
              {allRoles.map(roleInfo => (
                <div
                  key={roleInfo.value}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleRoleToggle(roleInfo.value)}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(roleInfo.value)}
                    onChange={() => handleRoleToggle(roleInfo.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{roleInfo.label}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getRoleColor(roleInfo.value)}`}>
                        {roleInfo.value}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {roleInfo.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || selectedRoles.length === 0 || !nome.trim() || !cognome.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? (isCreating ? 'Creando...' : 'Salvando...') : (isCreating ? 'Crea Utente' : 'Salva Modifiche')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}