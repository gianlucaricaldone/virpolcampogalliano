'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Building, Users, Edit, Trash2, Phone, Mail } from 'lucide-react'
import { Database } from '@/types/database'
import AvversarioForm from '@/components/forms/AvversarioForm'

type Avversario = Database['public']['Tables']['avversari']['Row'] & {
  categorie_avversari?: Database['public']['Tables']['categorie_avversari']['Row'][]
}

type CategoriaAvversario = Database['public']['Tables']['categorie_avversari']['Row']

export default function AvversariPage() {
  const { profile } = useAuth()
  const [avversari, setAvversari] = useState<Avversario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedAvversario, setSelectedAvversario] = useState<Avversario | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAvversari()
  }, [])

  const fetchAvversari = async () => {
    try {
      const { data, error } = await supabase
        .from('avversari')
        .select(`
          *,
          categorie_avversari (*)
        `)
        .order('nome_societa', { ascending: true })

      if (error) throw error
      setAvversari(data || [])
    } catch (error) {
      console.error('Error fetching avversari:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Sei sicuro di voler eliminare "${nome}" e tutte le sue categorie?`)) return
    
    try {
      const { error } = await supabase
        .from('avversari')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      fetchAvversari()
    } catch (error) {
      console.error('Error deleting avversario:', error)
      alert('Errore durante l\'eliminazione dell\'avversario')
    }
  }

  const handleEdit = (avversario: Avversario) => {
    setSelectedAvversario(avversario)
    setIsEditMode(true)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento avversari...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Avversari</h1>
          <p className="mt-2 text-gray-600">
            Gestisci le società avversarie e le loro categorie
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Avversario
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {avversari.map((avversario) => (
          <Card key={avversario.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    {avversario.nome_societa}
                  </CardTitle>
                  {avversario.citta && (
                    <CardDescription className="mt-1">
                      {avversario.citta}{avversario.provincia && ` (${avversario.provincia})`}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{avversario.categorie_avversari?.length || 0}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Categorie */}
                {avversario.categorie_avversari && avversario.categorie_avversari.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Categorie:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {avversario.categorie_avversari.map((categoria) => (
                        <span
                          key={categoria.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          {categoria.nome_categoria}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contatti */}
                {(avversario.telefono || avversario.email) && (
                  <div className="space-y-1">
                    {avversario.telefono && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2" />
                        {avversario.telefono}
                      </div>
                    )}
                    {avversario.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        {avversario.email}
                      </div>
                    )}
                  </div>
                )}

                {avversario.note && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Note:</span>
                    <p className="text-sm text-gray-600 mt-1">{avversario.note}</p>
                  </div>
                )}
              </div>
              
              {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(avversario)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Modifica
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(avversario.id, avversario.nome_societa)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {avversari.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun avversario registrato</p>
            {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
              <Button 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Registra il primo avversario
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <AvversarioForm
          avversario={selectedAvversario}
          isEditMode={isEditMode}
          onClose={() => {
            setShowForm(false)
            setSelectedAvversario(null)
            setIsEditMode(false)
          }}
          onSuccess={() => {
            fetchAvversari()
            setShowForm(false)
            setSelectedAvversario(null)
            setIsEditMode(false)
          }}
        />
      )}
    </div>
  )
}