'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trophy, Calendar, Clock, MapPin, Edit, Trash2 } from 'lucide-react'
import { Database } from '@/types/database'

type Partita = Database['public']['Tables']['partite']['Row'] & {
  squadre?: { nome: string }
}

export default function PartitePage() {
  const { profile } = useAuth()
  const [partite, setPartite] = useState<Partita[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const supabase = createClient()

  useEffect(() => {
    fetchPartite()
  }, [filter])

  const fetchPartite = async () => {
    try {
      let query = supabase
        .from('partite')
        .select(`
          *,
          squadre:squadra_id (nome)
        `)

      const today = new Date().toISOString().split('T')[0]
      
      if (filter === 'upcoming') {
        query = query.gte('data', today)
      } else if (filter === 'past') {
        query = query.lt('data', today)
      }

      query = query.order('data', { ascending: filter === 'past' ? false : true })

      const { data, error } = await query

      if (error) throw error
      setPartite(data || [])
    } catch (error) {
      console.error('Error fetching partite:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCompetitionColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'campionato':
        return 'bg-blue-100 text-blue-800'
      case 'coppa':
        return 'bg-purple-100 text-purple-800'
      case 'torneo':
        return 'bg-green-100 text-green-800'
      case 'amichevole':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const isUpcoming = (data: string) => {
    const today = new Date()
    const matchDate = new Date(data)
    return matchDate >= today
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento partite...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Partite</h1>
          <p className="mt-2 text-gray-600">
            Programma e gestisci le partite delle squadre
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Nuova Partita
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4">
            <Button
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilter('upcoming')}
            >
              Prossime Partite
            </Button>
            <Button
              variant={filter === 'past' ? 'default' : 'outline'}
              onClick={() => setFilter('past')}
            >
              Partite Passate
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Tutte
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Matches List */}
      <div className="space-y-4">
        {partite.map((partita) => (
          <Card key={partita.id} className={`hover:shadow-lg transition-shadow ${
            isUpcoming(partita.data) ? 'border-l-4 border-l-blue-500' : ''
          }`}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                {/* Match Info */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {partita.squadre?.nome} vs {partita.avversario}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCompetitionColor(partita.tipo_competizione)}`}>
                      {partita.tipo_competizione}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(partita.data).toLocaleDateString('it-IT')}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {partita.ora}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {partita.campo}
                    </div>
                  </div>
                  
                  {partita.note && (
                    <p className="text-sm text-gray-500 mt-2">{partita.note}</p>
                  )}
                </div>

                {/* Result */}
                <div className="text-center">
                  {partita.risultato ? (
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {partita.risultato}
                      </div>
                      <div className="text-sm text-gray-500">Risultato</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg text-gray-400">
                        {isUpcoming(partita.data) ? 'Da giocare' : 'N/D'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
                  <div className="flex space-x-2 justify-end">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-1" />
                      Modifica
                    </Button>
                    {isUpcoming(partita.data) && (
                      <Button variant="outline" size="sm">
                        <Trophy className="h-4 w-4 mr-1" />
                        Convoca
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {partite.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'upcoming' 
                ? 'Nessuna partita in programma' 
                : filter === 'past' 
                ? 'Nessuna partita passata'
                : 'Nessuna partita registrata'
              }
            </p>
            {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Programma una partita
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {filter === 'upcoming' && partite.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Prossimi Appuntamenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {partite.filter(p => {
                    const days = Math.ceil((new Date(p.data).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                    return days <= 7
                  }).length}
                </div>
                <div className="text-sm text-gray-600">Prossimi 7 giorni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {partite.filter(p => p.tipo_competizione.toLowerCase() === 'campionato').length}
                </div>
                <div className="text-sm text-gray-600">Partite di campionato</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {partite.filter(p => p.tipo_competizione.toLowerCase() === 'coppa').length}
                </div>
                <div className="text-sm text-gray-600">Partite di coppa</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}