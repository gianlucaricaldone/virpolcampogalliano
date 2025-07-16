'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { partiteApi } from '@/lib/api/partite'
import { CACHE_DURATIONS } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trophy, Calendar, Clock, MapPin, Edit, Trash2, Printer } from 'lucide-react'
import { Database } from '@/types/database'
import PartitaForm from '@/components/forms/PartitaForm'
import dynamic from 'next/dynamic'

// Import dinamico per evitare errori SSR con react-pdf
const LocandinaPartita = dynamic(() => import('@/components/pdf/LocandinaPartita'), {
  ssr: false,
  loading: () => <span>Caricamento...</span>
})

type Partita = Database['public']['Tables']['partite']['Row'] & {
  squadre?: { nome: string }
  categorie_avversari?: {
    nome_categoria: string
    avversari: {
      nome_societa: string
    }
  }
}

export default function PartitePage() {
  const { profile } = useAuth()
  const [partite, setPartite] = useState<Partita[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [selectedPartita, setSelectedPartita] = useState<Partita | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const fetchingRef = useRef(false)

  const fetchPartite = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = `partite_${filter}`
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = getCachedQuery<Partita[]>(cacheKey)
      if (cachedData) {
        console.log('[Partite] Using cached partite data for filter:', filter)
        setPartite(cachedData)
        setLoading(false)
        return
      }
    }

    // Check if there's already an ongoing fetch
    if (fetchingRef.current) {
      console.log('[Partite] Fetch already in progress, skipping duplicate request')
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      
      console.log('[Partite] Fetching partite data from API with filter:', filter)
      
      // Use centralized API
      const partiteData = await partiteApi.getPartite(filter)

      // Cache the result
      setCachedQuery(cacheKey, partiteData, CACHE_DURATIONS.SQUADRE) // Reuse squadre duration (5 min)
      console.log('[Partite] Data cached for', CACHE_DURATIONS.SQUADRE / 1000, 'seconds')

      setPartite(partiteData)
    } catch (error) {
      console.error('[Partite] Error fetching partite:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [filter])

  useEffect(() => {
    fetchPartite()
  }, [fetchPartite])

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa partita?')) return
    
    try {
      await partiteApi.deletePartita(id)
      fetchPartite(true) // Force refresh after delete
    } catch (error) {
      console.error('Error deleting partita:', error)
      alert('Errore durante l\'eliminazione della partita')
    }
  }

  const handleEdit = (partita: Partita) => {
    setSelectedPartita(partita)
    setIsEditMode(true)
    setShowForm(true)
  }

  // Use API utility functions
  const getCompetitionColor = (tipo: string) => partiteApi.getCompetitionColor(tipo)
  const isUpcoming = (data: string) => partiteApi.isUpcoming(data)
  const getAvversarioDisplay = (partita: Partita) => partiteApi.getAvversarioDisplay(partita)
  
  // Calculate stats using API
  const stats = partiteApi.calculateStats(partite)

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
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
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
                      {partita.squadre?.nome} vs {getAvversarioDisplay(partita)}
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
                <div className="flex space-x-2 justify-end">
                  <LocandinaPartita 
                    partita={partita}
                    buttonText={
                      <>
                        <Printer className="h-4 w-4 mr-1" />
                        Locandina
                      </>
                    }
                    buttonClassName="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  />
                  {(profile?.role === 'admin' || profile?.role === 'dirigente' || profile?.role === 'allenatore') && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(partita)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Modifica
                      </Button>
                      {isUpcoming(partita.data) && (
                        <Button variant="outline" size="sm">
                          <Trophy className="h-4 w-4 mr-1" />
                          Convoca
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(partita.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
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
              <Button 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
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
                  {stats.prossimi7Giorni}
                </div>
                <div className="text-sm text-gray-600">Prossimi 7 giorni</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.campionato}
                </div>
                <div className="text-sm text-gray-600">Partite di campionato</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.coppa}
                </div>
                <div className="text-sm text-gray-600">Partite di coppa</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <PartitaForm
          partita={selectedPartita}
          isEditMode={isEditMode}
          onClose={() => {
            setShowForm(false)
            setSelectedPartita(null)
            setIsEditMode(false)
          }}
          onSuccess={() => {
            fetchPartite(true) // Force refresh after create/edit
            setShowForm(false)
            setSelectedPartita(null)
            setIsEditMode(false)
          }}
        />
      )}
    </div>
  )
}