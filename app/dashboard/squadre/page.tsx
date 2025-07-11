'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { createClient } from '@/lib/supabase/client'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Edit, Trash2 } from 'lucide-react'
import { Database } from '@/types/database'
import SquadraForm from '@/components/forms/SquadraForm'

type Squadra = Database['public']['Tables']['squadre']['Row'] & {
  tesserati_count?: number
}

const SQUADRE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function SquadrePage() {
  const { profile, hasAnyRole } = useAuth()
  const { stagioneCorrente } = useSeason()
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSquadra, setEditingSquadra] = useState<Squadra | null>(null)
  const fetchingRef = useRef(false)
  const supabase = createClient()

  const fetchSquadre = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = `squadre_${stagioneCorrente?.id || 'all'}`
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = getCachedQuery<Squadra[]>(cacheKey)
      if (cachedData) {
        console.log('[Squadre] Using cached squadre data')
        setSquadre(cachedData)
        setLoading(false)
        return
      }
    }

    // Check if there's already an ongoing fetch
    if (fetchingRef.current) {
      console.log('[Squadre] Fetch already in progress, skipping duplicate request')
      return
    }

    // Prevent duplicate calls
    if (!forceRefresh && loading && squadre.length > 0) {
      console.log('[Squadre] Already loading with data, skipping')
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      
      console.log('[Squadre] Fetching squadre data from database')
      
      // Otteniamo squadre filtrate per stagione corrente
      let squadreQuery = supabase
        .from('squadre')
        .select('*')
        .order('categoria', { ascending: true })

      // Filtra per stagione corrente se impostata
      if (stagioneCorrente?.id) {
        squadreQuery = squadreQuery.eq('stagione_id', stagioneCorrente.id)
      }

      const { data: squadreData, error: squadreError } = await squadreQuery

      if (squadreError) throw squadreError

      // Otteniamo tutti i tesserati in una singola query
      const { data: tesseratiData, error: tesseratiError } = await supabase
        .from('tesserati')
        .select('squadra_id')

      if (tesseratiError) throw tesseratiError

      // Contiamo i tesserati per ogni squadra
      const tesseratiCount: Record<string, number> = {}
      tesseratiData?.forEach(tesserato => {
        if (tesserato.squadra_id) {
          tesseratiCount[tesserato.squadra_id] = (tesseratiCount[tesserato.squadra_id] || 0) + 1
        }
      })

      // Combiniamo i dati
      const squadreWithCount = (squadreData || []).map(squadra => ({
        ...squadra,
        tesserati_count: tesseratiCount[squadra.id] || 0
      }))

      // Cache the result
      setCachedQuery(cacheKey, squadreWithCount, SQUADRE_CACHE_DURATION)
      console.log('[Squadre] Data cached for', SQUADRE_CACHE_DURATION / 1000, 'seconds')

      setSquadre(squadreWithCount)
    } catch (error) {
      console.error('[Squadre] Error fetching squadre:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [stagioneCorrente?.id, supabase, loading, squadre.length])

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (isMounted) {
        await fetchSquadre()
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [fetchSquadre])

  const handleDeleteSquadra = async (squadraId: string, squadraNome: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la squadra "${squadraNome}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('squadre')
        .delete()
        .eq('id', squadraId)

      if (error) throw error

      alert('Squadra eliminata con successo')
      fetchSquadre(true) // Force refresh after delete
    } catch (error) {
      console.error('Error deleting squadra:', error)
      alert('Errore durante l\'eliminazione della squadra')
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
        {hasAnyRole(['admin', 'dirigente']) && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuova Squadra
          </Button>
        )}
      </div>

      {!stagioneCorrente && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center text-yellow-800">
              <Users className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Nessuna stagione corrente impostata. Contatta l'amministratore per impostare la stagione corrente.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {squadre.map((squadra) => (
          <Card key={squadra.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{squadra.nome}</CardTitle>
                  <CardDescription className="mt-1">
                    {squadra.categoria}
                    {stagioneCorrente && ` - ${stagioneCorrente.nome}`}
                  </CardDescription>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{squadra.tesserati_count || 0}</span>
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
                  <span className="font-medium">Vice Allenatori:</span>
                  <span className="ml-2 text-gray-600">
                    {squadra.vice_allenatore_1 || squadra.vice_allenatore_2 
                      ? [squadra.vice_allenatore_1, squadra.vice_allenatore_2].filter(Boolean).join(', ')
                      : 'Non assegnati'
                    }
                  </span>
                </div>
                <div>
                  <span className="font-medium">Dirigente:</span>
                  <span className="ml-2 text-gray-600">{squadra.dirigente || 'Non assegnato'}</span>
                </div>
              </div>
              
              {hasAnyRole(['admin', 'dirigente']) && (
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setEditingSquadra(squadra)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifica
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteSquadra(squadra.id, squadra.nome)}
                  >
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
            {hasAnyRole(['admin', 'dirigente']) && (
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
            fetchSquadre(true) // Force refresh after create
            setShowForm(false)
          }}
        />
      )}

      {editingSquadra && (
        <SquadraForm
          squadra={editingSquadra}
          onClose={() => setEditingSquadra(null)}
          onSuccess={() => {
            fetchSquadre(true) // Force refresh after edit
            setEditingSquadra(null)
          }}
        />
      )}
    </div>
  )
}