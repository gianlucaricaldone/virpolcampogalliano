'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Check, X, Filter, Search } from 'lucide-react'
import { Database } from '@/types/database'

type Presenza = Database['public']['Tables']['presenze']['Row'] & {
  tesserati?: { nome: string; cognome: string }
}

export default function PresenzePage() {
  const { profile } = useAuth()
  const [presenze, setPresenze] = useState<Presenza[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedType, setSelectedType] = useState<string>('allenamento')
  const supabase = createClient()

  useEffect(() => {
    fetchPresenze()
  }, [selectedDate, selectedType])

  const fetchPresenze = async () => {
    try {
      let query = supabase
        .from('presenze')
        .select(`
          *,
          tesserati:tesserato_id (nome, cognome)
        `)
        .eq('data', selectedDate)
        .order('created_at', { ascending: false })

      if (selectedType !== 'all') {
        query = query.eq('tipo', selectedType)
      }

      const { data, error } = await query

      if (error) throw error
      setPresenze(data || [])
    } catch (error) {
      console.error('Error fetching presenze:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePresenza = async (presenzaId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('presenze')
        .update({ presente: !currentStatus })
        .eq('id', presenzaId)

      if (error) throw error
      
      // Update local state
      setPresenze(prev => prev.map(p => 
        p.id === presenzaId ? { ...p, presente: !currentStatus } : p
      ))
    } catch (error) {
      console.error('Error updating presenza:', error)
    }
  }

  const presentiCount = presenze.filter(p => p.presente).length
  const percentualePresenza = presenze.length > 0 ? Math.round((presentiCount / presenze.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento presenze...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Presenze</h1>
          <p className="mt-2 text-gray-600">
            Registra e monitora le presenze agli allenamenti e alle partite
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Registra Presenze
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Attività
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutte</option>
                <option value="allenamento">Allenamento</option>
                <option value="partita">Partita</option>
                <option value="torneo">Torneo</option>
                <option value="evento">Evento</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Filter className="mr-2 h-4 w-4" />
                Applica Filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Presenti Oggi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {presentiCount}
            </div>
            <p className="text-sm text-gray-600">su {presenze.length} tesserati</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Percentuale Presenza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {percentualePresenza}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${percentualePresenza}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Assenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {presenze.length - presentiCount}
            </div>
            <p className="text-sm text-gray-600">tesserati assenti</p>
          </CardContent>
        </Card>
      </div>

      {/* Presences List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista Presenze - {new Date(selectedDate).toLocaleDateString('it-IT')}</CardTitle>
          <CardDescription>
            {selectedType === 'all' ? 'Tutte le attività' : `Attività: ${selectedType}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {presenze.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                Nessuna presenza registrata per questa data
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {presenze.map((presenza) => (
                <div
                  key={presenza.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      presenza.presente ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <h4 className="font-medium">
                        {presenza.tesserati?.nome} {presenza.tesserati?.cognome}
                      </h4>
                      <p className="text-sm text-gray-500 capitalize">
                        {presenza.tipo}
                        {presenza.note && ` - ${presenza.note}`}
                      </p>
                    </div>
                  </div>
                  
                  {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={presenza.presente ? "default" : "outline"}
                        onClick={() => togglePresenza(presenza.id, presenza.presente)}
                        className={presenza.presente ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={!presenza.presente ? "default" : "outline"}
                        onClick={() => togglePresenza(presenza.id, presenza.presente)}
                        className={!presenza.presente ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}