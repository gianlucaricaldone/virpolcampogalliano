'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'
import { Database } from '@/types/database'

type Squadra = Database['public']['Tables']['squadre']['Row']
type CategoriaAvversario = Database['public']['Tables']['categorie_avversari']['Row'] & {
  avversari?: { nome_societa: string }
}

interface PartitaFormProps {
  onClose: () => void
  onSuccess: () => void
  partita?: Database['public']['Tables']['partite']['Row'] | null
  isEditMode?: boolean
}

export default function PartitaForm({ onClose, onSuccess, partita, isEditMode = false }: PartitaFormProps) {
  const [loading, setLoading] = useState(false)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [categorieAvversari, setCategorieAvversari] = useState<CategoriaAvversario[]>([])
  const [searchAvversario, setSearchAvversario] = useState('')
  const [showNewAvversario, setShowNewAvversario] = useState(false)
  const [newAvversarioData, setNewAvversarioData] = useState({
    nome_societa: '',
    categoria: '',
    citta: ''
  })
  
  const [formData, setFormData] = useState({
    squadra_id: partita?.squadra_id || '',
    data: partita?.data || '',
    ora: partita?.ora || '',
    campo: partita?.campo || '',
    avversario: partita?.avversario || '',
    categoria_avversario_id: partita?.categoria_avversario_id || '',
    tipo_competizione: partita?.tipo_competizione || 'campionato',
    risultato: partita?.risultato || '',
    note: partita?.note || ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchSquadre()
    fetchCategorieAvversari()
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

  const fetchCategorieAvversari = async () => {
    try {
      const { data, error } = await supabase
        .from('categorie_avversari')
        .select(`
          *,
          avversari:avversario_id (nome_societa)
        `)
        .order('nome_categoria', { ascending: true })

      if (error) throw error
      setCategorieAvversari(data || [])
    } catch (error) {
      console.error('Error fetching categorie avversari:', error)
    }
  }

  const createNewAvversario = async () => {
    if (!newAvversarioData.nome_societa || !newAvversarioData.categoria) {
      alert('Nome società e categoria sono obbligatori')
      return null
    }

    try {
      // Prima creiamo l'avversario
      const { data: avversarioData, error: avversarioError } = await supabase
        .from('avversari')
        .insert({
          nome_societa: newAvversarioData.nome_societa,
          citta: newAvversarioData.citta || null
        })
        .select()
        .single()

      if (avversarioError) throw avversarioError

      // Poi creiamo la categoria
      const { data: categoriaData, error: categoriaError } = await supabase
        .from('categorie_avversari')
        .insert({
          avversario_id: avversarioData.id,
          nome_categoria: newAvversarioData.categoria
        })
        .select()
        .single()

      if (categoriaError) throw categoriaError

      // Aggiorniamo la lista
      await fetchCategorieAvversari()
      
      return categoriaData.id
    } catch (error) {
      console.error('Error creating new avversario:', error)
      alert('Errore durante la creazione dell\'avversario')
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let categoriaAvversarioId = formData.categoria_avversario_id

      // Se stiamo creando un nuovo avversario
      if (showNewAvversario) {
        categoriaAvversarioId = await createNewAvversario()
        if (!categoriaAvversarioId) {
          setLoading(false)
          return
        }
      }

      const dataToSubmit = {
        ...formData,
        categoria_avversario_id: categoriaAvversarioId || null,
        data: formData.data || null,
        ora: formData.ora || null
      }

      if (isEditMode && partita) {
        const { error } = await supabase
          .from('partite')
          .update(dataToSubmit)
          .eq('id', partita.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('partite')
          .insert(dataToSubmit)

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} partita:`, error)
      alert(`Errore durante ${isEditMode ? 'l\'aggiornamento' : 'la creazione'} della partita`)
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

  const handleNewAvversarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAvversarioData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const filteredAvversari = categorieAvversari.filter(cat =>
    cat.avversari?.nome_societa?.toLowerCase().includes(searchAvversario.toLowerCase()) ||
    cat.nome_categoria?.toLowerCase().includes(searchAvversario.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditMode ? 'Modifica Partita' : 'Nuova Partita'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Squadra *
                </label>
                <select
                  name="squadra_id"
                  value={formData.squadra_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona squadra...</option>
                  {squadre.map(squadra => (
                    <option key={squadra.id} value={squadra.id}>
                      {squadra.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo Competizione *
                </label>
                <select
                  name="tipo_competizione"
                  value={formData.tipo_competizione}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="campionato">Campionato</option>
                  <option value="coppa">Coppa</option>
                  <option value="torneo">Torneo</option>
                  <option value="amichevole">Amichevole</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ora *
                </label>
                <input
                  type="time"
                  name="ora"
                  value={formData.ora}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campo *
                </label>
                <input
                  type="text"
                  name="campo"
                  value={formData.campo}
                  onChange={handleChange}
                  required
                  placeholder="Nome del campo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Risultato
                </label>
                <input
                  type="text"
                  name="risultato"
                  value={formData.risultato}
                  onChange={handleChange}
                  placeholder="es. 2-1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Avversario Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Squadra Avversaria *
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewAvversario(!showNewAvversario)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nuovo Avversario
                </Button>
              </div>

              {showNewAvversario ? (
                <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="nome_societa"
                      value={newAvversarioData.nome_societa}
                      onChange={handleNewAvversarioChange}
                      placeholder="Nome società *"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      name="categoria"
                      value={newAvversarioData.categoria}
                      onChange={handleNewAvversarioChange}
                      placeholder="Categoria (es. Pulcini) *"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <input
                    type="text"
                    name="citta"
                    value={newAvversarioData.citta}
                    onChange={handleNewAvversarioChange}
                    placeholder="Città"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={searchAvversario}
                    onChange={(e) => setSearchAvversario(e.target.value)}
                    placeholder="Cerca squadra avversaria..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <select
                    name="categoria_avversario_id"
                    value={formData.categoria_avversario_id}
                    onChange={handleChange}
                    required={!showNewAvversario}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleziona avversario...</option>
                    {filteredAvversari.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.avversari?.nome_societa} - {cat.nome_categoria}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : isEditMode ? 'Aggiorna Partita' : 'Salva Partita'}
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