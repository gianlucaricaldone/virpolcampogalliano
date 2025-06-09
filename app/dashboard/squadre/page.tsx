'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Edit, Trash2 } from 'lucide-react'
import { Database } from '@/types/database'
import SquadraForm from '@/components/forms/SquadraForm'

type Squadra = Database['public']['Tables']['squadre']['Row']

export default function SquadrePage() {
  const { profile } = useAuth()
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSquadre()
  }, [])

  const fetchSquadre = async () => {
    try {
      const { data, error } = await supabase
        .from('squadre')
        .select('*')
        .order('categoria', { ascending: true })

      if (error) throw error
      setSquadre(data || [])
    } catch (error) {
      console.error('Error fetching squadre:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento squadre...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Squadre</h1>
          <p className="mt-2 text-gray-600">
            Visualizza e gestisci tutte le squadre della società
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuova Squadra
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {squadre.map((squadra) => (
          <Card key={squadra.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{squadra.nome}</CardTitle>
                  <CardDescription className="mt-1">
                    {squadra.categoria} - Stagione {squadra.stagione}
                  </CardDescription>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="h-4 w-4 mr-1" />
                  <span>25</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Allenatore:</span>
                  <span className="ml-2 text-gray-600">{squadra.allenatore || 'Non assegnato'}</span>
                </div>
                <div>
                  <span className="font-medium">Vice Allenatore:</span>
                  <span className="ml-2 text-gray-600">{squadra.vice_allenatore || 'Non assegnato'}</span>
                </div>
                <div>
                  <span className="font-medium">Dirigente:</span>
                  <span className="ml-2 text-gray-600">{squadra.dirigente || 'Non assegnato'}</span>
                </div>
              </div>
              
              {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="h-4 w-4 mr-1" />
                    Modifica
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {squadre.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessuna squadra registrata</p>
            {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
              <Button 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea la prima squadra
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <SquadraForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            fetchSquadre()
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}