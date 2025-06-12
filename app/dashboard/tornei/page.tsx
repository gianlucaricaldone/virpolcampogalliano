'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trophy, Calendar, Users, Edit, Trash2, Eye, EyeOff, UserPlus, UserCheck, MapPin, Mail, Phone } from 'lucide-react'
import { Database } from '@/types/database'
import TorneoForm from '@/components/forms/TorneoForm'

type Torneo = Database['public']['Tables']['tornei']['Row']

export default function TorneiPage() {
  const { profile } = useAuth()
  const [tornei, setTornei] = useState<Torneo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTorneo, setSelectedTorneo] = useState<Torneo | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchTornei()
  }, [filter])

  const fetchTornei = async () => {
    try {
      let query = supabase
        .from('tornei')
        .select('*')

      const today = new Date().toISOString().split('T')[0]
      
      if (filter === 'active') {
        query = query.eq('attivo', true)
      } else if (filter === 'upcoming') {
        query = query.gte('data_inizio', today)
      } else if (filter === 'past') {
        query = query.lt('data_fine', today)
      }

      query = query.order('data_inizio', { ascending: false })

      const { data, error } = await query

      if (error) throw error
      setTornei(data || [])
    } catch (error) {
      console.error('Error fetching tornei:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAttivo = async (torneo: Torneo) => {
    try {
      const { error } = await supabase
        .from('tornei')
        .update({ attivo: !torneo.attivo })
        .eq('id', torneo.id)

      if (error) throw error
      fetchTornei()
    } catch (error) {
      console.error('Error updating torneo:', error)
      alert('Errore durante l\'aggiornamento del torneo')
    }
  }

  const toggleIscrizioni = async (torneo: Torneo) => {
    try {
      const { error } = await supabase
        .from('tornei')
        .update({ iscrizioni_aperte: !torneo.iscrizioni_aperte })
        .eq('id', torneo.id)

      if (error) throw error
      fetchTornei()
    } catch (error) {
      console.error('Error updating iscrizioni:', error)
      alert('Errore durante l\'aggiornamento delle iscrizioni')
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il torneo "${nome}"?`)) return
    
    try {
      const { error } = await supabase
        .from('tornei')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      fetchTornei()
    } catch (error) {
      console.error('Error deleting torneo:', error)
      alert('Errore durante l\'eliminazione del torneo')
    }
  }

  const handleEdit = (torneo: Torneo) => {
    setSelectedTorneo(torneo)
    setIsEditMode(true)
    setShowForm(true)
  }

  const getStatusBadge = (torneo: Torneo) => {
    const today = new Date()
    const startDate = new Date(torneo.data_inizio)
    const endDate = new Date(torneo.data_fine)

    if (endDate < today) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Concluso</span>
    }
    if (startDate <= today && endDate >= today) {
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">In Corso</span>
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Prossimo</span>
  }

  const isRegistrationPeriod = (torneo: Torneo) => {
    const today = new Date()
    const startDate = new Date(torneo.data_inizio)
    return startDate > today // Solo se il torneo non è ancora iniziato
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento tornei...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Tornei</h1>
          <p className="mt-2 text-gray-600">
            Gestisci i tornei organizzati dalla società
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Torneo
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Tutti
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              onClick={() => setFilter('active')}
            >
              Attivi
            </Button>
            <Button
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilter('upcoming')}
            >
              Prossimi
            </Button>
            <Button
              variant={filter === 'past' ? 'default' : 'outline'}
              onClick={() => setFilter('past')}
            >
              Conclusi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tornei List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tornei.map((torneo) => (
          <Card key={torneo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center">
                    <Trophy className="h-5 w-5 mr-2" />
                    {torneo.nome}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {torneo.luogo && `${torneo.luogo} • `}
                    {new Date(torneo.data_inizio).toLocaleDateString('it-IT')} - {new Date(torneo.data_fine).toLocaleDateString('it-IT')}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1">
                  {getStatusBadge(torneo)}
                  {torneo.attivo && (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      Visibile
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {torneo.descrizione && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {torneo.descrizione}
                  </p>
                )}

                {/* Informazioni squadre */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Squadre:</span>
                  <span className="font-medium">
                    {torneo.numero_squadre_iscritte || 0}
                    {torneo.numero_squadre_max && ` / ${torneo.numero_squadre_max}`}
                  </span>
                </div>

                {/* Stato iscrizioni */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Iscrizioni:</span>
                  <div className="flex items-center gap-2">
                    {torneo.iscrizioni_aperte ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Aperte
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center">
                        <UserPlus className="h-3 w-3 mr-1" />
                        Chiuse
                      </span>
                    )}
                  </div>
                </div>

                {/* Contatti */}
                {(torneo.contatto_email || torneo.contatto_telefono) && (
                  <div className="border-t pt-3 space-y-1">
                    {torneo.contatto_email && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Mail className="h-3 w-3 mr-1" />
                        {torneo.contatto_email}
                      </div>
                    )}
                    {torneo.contatto_telefono && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Phone className="h-3 w-3 mr-1" />
                        {torneo.contatto_telefono}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAttivo(torneo)}
                        className="flex-1"
                      >
                        {torneo.attivo ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-1" />
                            Nascondi
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            Mostra
                          </>
                        )}
                      </Button>
                      {isRegistrationPeriod(torneo) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleIscrizioni(torneo)}
                          className="flex-1"
                        >
                          {torneo.iscrizioni_aperte ? (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Chiudi
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" />
                              Apri
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEdit(torneo)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Modifica
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(torneo.id, torneo.nome)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tornei.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {filter === 'active' 
                ? 'Nessun torneo attivo al momento' 
                : filter === 'upcoming' 
                ? 'Nessun torneo in programma'
                : filter === 'past'
                ? 'Nessun torneo concluso'
                : 'Nessun torneo registrato'
              }
            </p>
            {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
              <Button 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea il primo torneo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <TorneoForm
          torneo={selectedTorneo}
          isEditMode={isEditMode}
          onClose={() => {
            setShowForm(false)
            setSelectedTorneo(null)
            setIsEditMode(false)
          }}
          onSuccess={() => {
            fetchTornei()
            setShowForm(false)
            setSelectedTorneo(null)
            setIsEditMode(false)
          }}
        />
      )}
    </div>
  )
}