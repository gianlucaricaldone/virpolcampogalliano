'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { Database } from '@/types/database'

type Squadra = Database['public']['Tables']['squadre']['Row']

interface AllenatoreFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function AllenatoreForm({ onClose, onSuccess }: AllenatoreFormProps) {
  const [loading, setLoading] = useState(false)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [formData, setFormData] = useState({
    email: '',
    nome: '',
    cognome: '',
    telefono: '',
    data_nascita: '',
    squadra_id: [] as string[],
    note: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchSquadre()
  }, [])

  const fetchSquadre = async () => {
    try {
      const { data, error } = await supabase
        .from('squadre')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setSquadre(data || [])
    } catch (error) {
      console.error('Error fetching squadre:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Crea solo il profilo utente - l'email di invito verrà inviata successivamente se necessario
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          email: formData.email || null,
          nome: formData.nome,
          cognome: formData.cognome,
          telefono: formData.telefono || null,
          data_nascita: formData.data_nascita || null,
          squadra_id: formData.squadra_id.length > 0 ? formData.squadra_id : null,
          note: formData.note || null,
          role: 'allenatore',
          roles: ['allenatore'],
          has_logged_in: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

        if (profileError) throw profileError

        // 3. Update squadre with new allenatore if selected
        if (formData.squadra_id.length > 0) {
          const allenatoreNome = `${formData.cognome} ${formData.nome}`
          
          for (const squadraId of formData.squadra_id) {
            const { error: squadraError } = await supabase
              .from('squadre')
              .update({ 
                allenatore: allenatoreNome,
                updated_at: new Date().toISOString()
              })
              .eq('id', squadraId)

            if (squadraError) throw squadraError
          }
        }

      if (formData.email) {
        alert('Allenatore creato con successo! Usa il tasto "Invia Email" nella lista utenti per inviare l\'invito di accesso.')
      } else {
        alert('Allenatore creato con successo! Aggiungi un\'email per inviare l\'invito di accesso.')
      }
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating allenatore:', error)
      alert(`Errore durante la creazione dell'allenatore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'squadra_id') {
      const select = e.target as HTMLSelectElement
      const selectedOptions = Array.from(select.selectedOptions, option => option.value)
      setFormData(prev => ({
        ...prev,
        squadra_id: selectedOptions
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nuovo Allenatore</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium text-blue-900 mb-2">Informazioni Account</h3>
              <p className="text-sm text-blue-700">
                Verrà creato un account che permetterà all'allenatore di accedere alla dashboard
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email * <span className="text-xs text-gray-500">(per login)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Riceverà un'email con un link per accedere senza password
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome *
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  name="data_nascita"
                  value={formData.data_nascita}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Squadre Assegnate
              </label>
              <select
                name="squadra_id"
                multiple
                value={formData.squadra_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              >
                {squadre.map(squadra => (
                  <option key={squadra.id} value={squadra.id}>
                    {squadra.nome} - {squadra.categoria}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Tieni premuto Ctrl/Cmd per selezionare più squadre
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                name="note"
                value={formData.note}
                onChange={handleChange}
                rows={3}
                placeholder="Note aggiuntive sull'allenatore..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-1">Importante:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• L'allenatore riceverà una email con un link di accesso diretto</li>
                <li>• Non serve password: ogni volta potrà richiedere un nuovo link di accesso</li>
                <li>• Avrà accesso alla dashboard con permessi di allenatore</li>
                <li>• Potrà gestire presenze e partite delle squadre assegnate</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creando Account...' : 'Crea Allenatore'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}