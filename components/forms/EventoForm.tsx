'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

interface EventoFormProps {
  eventoId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function EventoForm({ eventoId, onClose, onSuccess }: EventoFormProps) {
  const { user } = useAuth()
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    data_evento: '',
    luogo: '',
    costo_persona: '',
    max_partecipanti: '',
    tipologia: 'altro'
  })

  useEffect(() => {
    if (eventoId) {
      fetchEvento()
    }
  }, [eventoId])

  const fetchEvento = async () => {
    try {
      const { data, error } = await supabase
        .from('eventi')
        .select('*')
        .eq('id', eventoId)
        .single()

      if (error) throw error

      setFormData({
        nome: data.nome || '',
        descrizione: data.descrizione || '',
        data_evento: data.data_evento ? new Date(data.data_evento).toISOString().slice(0, 16) : '',
        luogo: data.luogo || '',
        costo_persona: data.costo_persona?.toString() || '',
        max_partecipanti: data.max_partecipanti?.toString() || '',
        tipologia: data.tipologia || 'altro'
      })
    } catch (error) {
      console.error('Errore nel caricamento dell\'evento:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const eventData = {
        nome: formData.nome,
        descrizione: formData.descrizione || null,
        data_evento: formData.data_evento,
        luogo: formData.luogo || null,
        costo_persona: formData.costo_persona ? parseFloat(formData.costo_persona) : null,
        max_partecipanti: formData.max_partecipanti ? parseInt(formData.max_partecipanti) : null,
        tipologia: formData.tipologia,
        created_by: user?.id
      }

      if (eventoId) {
        const { error } = await supabase
          .from('eventi')
          .update(eventData)
          .eq('id', eventoId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('eventi')
          .insert([eventData])

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Errore nel salvataggio dell\'evento:', error)
      alert('Errore nel salvataggio dell\'evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {eventoId ? 'Modifica Evento' : 'Nuovo Evento'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome Evento *
              </label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                placeholder="Es. Cena di Natale"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Descrizione
              </label>
              <textarea
                name="descrizione"
                value={formData.descrizione}
                onChange={handleChange}
                rows={3}
                placeholder="Descrizione dell'evento..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data e Ora *
              </label>
              <input
                type="datetime-local"
                name="data_evento"
                value={formData.data_evento}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Luogo
              </label>
              <input
                type="text"
                name="luogo"
                value={formData.luogo}
                onChange={handleChange}
                placeholder="Es. Ristorante da Mario, Via Roma 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipologia Evento *
              </label>
              <select
                name="tipologia"
                value={formData.tipologia}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cena">Cena</option>
                <option value="altro">Altro</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Costo a Persona (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="costo_persona"
                  value={formData.costo_persona}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Numero Massimo Partecipanti
                </label>
                <input
                  type="number"
                  name="max_partecipanti"
                  value={formData.max_partecipanti}
                  onChange={handleChange}
                  placeholder="Lascia vuoto per illimitato"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvataggio...' : (eventoId ? 'Salva Modifiche' : 'Crea Evento')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}