'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Plus, Trash2, User, Phone, Mail } from 'lucide-react'
import { Database } from '@/types/database'

type Avversario = Database['public']['Tables']['avversari']['Row'] & {
  categorie_avversari?: Database['public']['Tables']['categorie_avversari']['Row'][]
}

type CategoriaAvversario = Database['public']['Tables']['categorie_avversari']['Row']

interface CategoriaForm {
  id?: string
  nome_categoria: string
  responsabile_nome: string
  responsabile_telefono: string
  responsabile_email: string
  note: string
  isNew?: boolean
}

interface AvversarioFormProps {
  onClose: () => void
  onSuccess: () => void
  avversario?: Avversario | null
  isEditMode?: boolean
}

export default function AvversarioForm({ onClose, onSuccess, avversario, isEditMode = false }: AvversarioFormProps) {
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    nome_societa: avversario?.nome_societa || '',
    citta: avversario?.citta || '',
    provincia: avversario?.provincia || '',
    telefono: avversario?.telefono || '',
    email: avversario?.email || '',
    sito_web: avversario?.sito_web || '',
    note: avversario?.note || ''
  })

  const [categorie, setCategorie] = useState<CategoriaForm[]>([])

  const supabase = createClient()

  useEffect(() => {
    if (isEditMode && avversario?.categorie_avversari) {
      setCategorie(avversario.categorie_avversari.map(cat => ({
        id: cat.id,
        nome_categoria: cat.nome_categoria,
        responsabile_nome: cat.responsabile_nome || '',
        responsabile_telefono: cat.responsabile_telefono || '',
        responsabile_email: cat.responsabile_email || '',
        note: cat.note || '',
        isNew: false
      })))
    } else {
      // Aggiungi una categoria vuota di default
      setCategorie([{
        nome_categoria: '',
        responsabile_nome: '',
        responsabile_telefono: '',
        responsabile_email: '',
        note: '',
        isNew: true
      }])
    }
  }, [isEditMode, avversario])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleCategoriaChange = (index: number, field: keyof CategoriaForm, value: string) => {
    setCategorie(prev => prev.map((cat, i) => 
      i === index ? { ...cat, [field]: value } : cat
    ))
  }

  const addCategoria = () => {
    setCategorie(prev => [...prev, {
      nome_categoria: '',
      responsabile_nome: '',
      responsabile_telefono: '',
      responsabile_email: '',
      note: '',
      isNew: true
    }])
  }

  const removeCategoria = async (index: number) => {
    const categoria = categorie[index]
    
    // Se è una categoria esistente, chiedere conferma
    if (!categoria.isNew && categoria.id) {
      if (!confirm('Sei sicuro di voler eliminare questa categoria? Tutte le partite associate verranno scolegate.')) {
        return
      }
      
      try {
        const { error } = await supabase
          .from('categorie_avversari')
          .delete()
          .eq('id', categoria.id)

        if (error) throw error
      } catch (error) {
        console.error('Error deleting categoria:', error)
        alert('Errore durante l\'eliminazione della categoria')
        return
      }
    }
    
    setCategorie(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validazione base
      if (!formData.nome_societa) {
        alert('Il nome della società è obbligatorio')
        setLoading(false)
        return
      }

      // Verifica che ci sia almeno una categoria con nome
      const categorieValide = categorie.filter(cat => cat.nome_categoria.trim() !== '')
      if (categorieValide.length === 0) {
        alert('Inserisci almeno una categoria')
        setLoading(false)
        return
      }

      let avversarioId: string

      if (isEditMode && avversario) {
        // Aggiorna avversario esistente
        const { error: updateError } = await supabase
          .from('avversari')
          .update({
            nome_societa: formData.nome_societa,
            citta: formData.citta || null,
            provincia: formData.provincia || null,
            telefono: formData.telefono || null,
            email: formData.email || null,
            sito_web: formData.sito_web || null,
            note: formData.note || null
          })
          .eq('id', avversario.id)

        if (updateError) throw updateError
        avversarioId = avversario.id
      } else {
        // Crea nuovo avversario
        const { data: newAvversario, error: insertError } = await supabase
          .from('avversari')
          .insert({
            nome_societa: formData.nome_societa,
            citta: formData.citta || null,
            provincia: formData.provincia || null,
            telefono: formData.telefono || null,
            email: formData.email || null,
            sito_web: formData.sito_web || null,
            note: formData.note || null
          })
          .select()
          .single()

        if (insertError) throw insertError
        avversarioId = newAvversario.id
      }

      // Gestisci le categorie
      for (const categoria of categorieValide) {
        if (categoria.isNew || !categoria.id) {
          // Inserisci nuova categoria
          const { error } = await supabase
            .from('categorie_avversari')
            .insert({
              avversario_id: avversarioId,
              nome_categoria: categoria.nome_categoria,
              responsabile_nome: categoria.responsabile_nome || null,
              responsabile_telefono: categoria.responsabile_telefono || null,
              responsabile_email: categoria.responsabile_email || null,
              note: categoria.note || null
            })

          if (error) throw error
        } else {
          // Aggiorna categoria esistente
          const { error } = await supabase
            .from('categorie_avversari')
            .update({
              nome_categoria: categoria.nome_categoria,
              responsabile_nome: categoria.responsabile_nome || null,
              responsabile_telefono: categoria.responsabile_telefono || null,
              responsabile_email: categoria.responsabile_email || null,
              note: categoria.note || null
            })
            .eq('id', categoria.id)

          if (error) throw error
        }
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} avversario:`, error)
      alert(`Errore durante ${isEditMode ? 'l\'aggiornamento' : 'la creazione'} dell'avversario`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditMode ? 'Modifica Avversario' : 'Nuovo Avversario'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informazioni Società */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Informazioni Società</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Società *
                  </label>
                  <input
                    type="text"
                    name="nome_societa"
                    value={formData.nome_societa}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. ASD Esempio Calcio"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    name="citta"
                    value={formData.citta}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. Modena"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    name="provincia"
                    value={formData.provincia}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. MO"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Telefono
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. 059 123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. info@esempio.it"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sito Web
                  </label>
                  <input
                    type="url"
                    name="sito_web"
                    value={formData.sito_web}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. https://www.esempio.it"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Società
                  </label>
                  <textarea
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Note aggiuntive sulla società..."
                  />
                </div>
              </div>
            </div>

            {/* Categorie */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Categorie e Responsabili</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCategoria}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi Categoria
                </Button>
              </div>

              <div className="space-y-4">
                {categorie.map((categoria, index) => (
                  <Card key={index} className="p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-800">
                        Categoria {index + 1}
                      </h4>
                      {categorie.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCategoria(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome Categoria *
                        </label>
                        <input
                          type="text"
                          value={categoria.nome_categoria}
                          onChange={(e) => handleCategoriaChange(index, 'nome_categoria', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="es. Pulcini, Esordienti, Giovanissimi..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <User className="inline h-4 w-4 mr-1" />
                          Responsabile
                        </label>
                        <input
                          type="text"
                          value={categoria.responsabile_nome}
                          onChange={(e) => handleCategoriaChange(index, 'responsabile_nome', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Nome del responsabile"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Phone className="inline h-4 w-4 mr-1" />
                          Telefono Responsabile
                        </label>
                        <input
                          type="tel"
                          value={categoria.responsabile_telefono}
                          onChange={(e) => handleCategoriaChange(index, 'responsabile_telefono', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Telefono del responsabile"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Mail className="inline h-4 w-4 mr-1" />
                          Email Responsabile
                        </label>
                        <input
                          type="email"
                          value={categoria.responsabile_email}
                          onChange={(e) => handleCategoriaChange(index, 'responsabile_email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Email del responsabile"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Note Categoria
                        </label>
                        <input
                          type="text"
                          value={categoria.note}
                          onChange={(e) => handleCategoriaChange(index, 'note', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Note per questa categoria"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : isEditMode ? 'Aggiorna Avversario' : 'Salva Avversario'}
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