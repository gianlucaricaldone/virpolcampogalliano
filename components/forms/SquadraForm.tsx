'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']

interface SquadraFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function SquadraForm({ onClose, onSuccess }: SquadraFormProps) {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    stagione: new Date().getFullYear().toString(),
    allenatore: '',
    vice_allenatore: '',
    dirigente: '',
    descrizione: ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['allenatore', 'dirigente'])
        .order('cognome', { ascending: true })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('squadre')
        .insert({
          ...formData,
          allenatore: formData.allenatore || null,
          vice_allenatore: formData.vice_allenatore || null,
          dirigente: formData.dirigente || null
        })

      if (error) throw error

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating squadra:', error)
      alert('Errore durante la creazione della squadra')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const allenatori = users.filter(u => u.role === 'allenatore')
  const dirigenti = users.filter(u => u.role === 'dirigente')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nuova Squadra</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Squadra *
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                placeholder="es. Prima Squadra, Allievi U17..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona categoria...</option>
                <option value="Prima Squadra">Prima Squadra</option>
                <option value="Juniores">Juniores</option>
                <option value="Allievi U17">Allievi U17</option>
                <option value="Allievi U16">Allievi U16</option>
                <option value="Giovanissimi U15">Giovanissimi U15</option>
                <option value="Giovanissimi U14">Giovanissimi U14</option>
                <option value="Esordienti U13">Esordienti U13</option>
                <option value="Esordienti U12">Esordienti U12</option>
                <option value="Pulcini U11">Pulcini U11</option>
                <option value="Pulcini U10">Pulcini U10</option>
                <option value="Piccoli Amici U9">Piccoli Amici U9</option>
                <option value="Piccoli Amici U8">Piccoli Amici U8</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stagione *
              </label>
              <input
                type="text"
                name="stagione"
                value={formData.stagione}
                onChange={handleChange}
                required
                placeholder="2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allenatore
              </label>
              <select
                name="allenatore"
                value={formData.allenatore}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona allenatore...</option>
                {allenatori.map(user => (
                  <option key={user.id} value={`${user.nome} ${user.cognome}`}>
                    {user.nome} {user.cognome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vice Allenatore
              </label>
              <select
                name="vice_allenatore"
                value={formData.vice_allenatore}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona vice allenatore...</option>
                {allenatori.map(user => (
                  <option key={user.id} value={`${user.nome} ${user.cognome}`}>
                    {user.nome} {user.cognome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirigente
              </label>
              <select
                name="dirigente"
                value={formData.dirigente}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona dirigente...</option>
                {dirigenti.map(user => (
                  <option key={user.id} value={`${user.nome} ${user.cognome}`}>
                    {user.nome} {user.cognome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione
              </label>
              <textarea
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                rows={3}
                placeholder="Descrizione della squadra, obiettivi, note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : 'Salva Squadra'}
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