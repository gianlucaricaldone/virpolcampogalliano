'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { Database } from '@/types/database'

type Squadra = Database['public']['Tables']['squadre']['Row']

interface TesseratoFormProps {
  onClose: () => void
  onSuccess: () => void
  tesserato?: Database['public']['Tables']['tesserati']['Row'] | null
  isEditMode?: boolean
}

export default function TesseratoForm({ onClose, onSuccess, tesserato, isEditMode = false }: TesseratoFormProps) {
  const [loading, setLoading] = useState(false)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [formData, setFormData] = useState({
    nome: tesserato?.nome || '',
    cognome: tesserato?.cognome || '',
    data_nascita: tesserato?.data_nascita || '',
    codice_fiscale: tesserato?.codice_fiscale || '',
    squadra_id: tesserato?.squadra_id || '',
    codice_cartellino: tesserato?.codice_cartellino || '',
    email: tesserato?.email || '',
    telefono: tesserato?.telefono || '',
    indirizzo: tesserato?.indirizzo || '',
    citta: tesserato?.citta || '',
    cap: tesserato?.cap || '',
    documento_identita: tesserato?.documento_identita || '',
    certificato_medico: tesserato?.certificato_medico || '',
    scadenza_certificato: tesserato?.scadenza_certificato || '',
    stato_pagamento: tesserato?.stato_pagamento || 'non_pagato',
    visita_sportiva: tesserato?.visita_sportiva || false,
    note_pagamento: tesserato?.note_pagamento || ''
  })

  const supabase = createClient()

  useEffect(() => {
    fetchSquadre()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSubmit = {
        ...formData,
        squadra_id: formData.squadra_id || null,
        data_nascita: formData.data_nascita || null,
        scadenza_certificato: formData.scadenza_certificato || null,
        codice_cartellino: formData.codice_cartellino || null,
        visita_sportiva: formData.visita_sportiva
      }

      if (isEditMode && tesserato) {
        const { error } = await supabase
          .from('tesserati')
          .update(dataToSubmit)
          .eq('id', tesserato.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tesserati')
          .insert(dataToSubmit)

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} tesserato:`, error)
      alert(`Errore durante ${isEditMode ? 'l\'aggiornamento' : 'la creazione'} del tesserato`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditMode ? 'Modifica Tesserato' : 'Nuovo Tesserato'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome *
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  name="data_nascita"
                  value={formData.data_nascita}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  name="codice_fiscale"
                  value={formData.codice_fiscale}
                  onChange={handleChange}
                  maxLength={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Squadra
                </label>
                <select
                  name="squadra_id"
                  value={formData.squadra_id}
                  onChange={handleChange}
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
                  Codice Cartellino
                </label>
                <input
                  type="text"
                  name="codice_cartellino"
                  value={formData.codice_cartellino}
                  onChange={handleChange}
                  placeholder="Codice del cartellino"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Indirizzo
                </label>
                <input
                  type="text"
                  name="indirizzo"
                  value={formData.indirizzo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CAP
                </label>
                <input
                  type="text"
                  name="cap"
                  value={formData.cap}
                  onChange={handleChange}
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento Identità
                </label>
                <input
                  type="text"
                  name="documento_identita"
                  value={formData.documento_identita}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificato Medico
                </label>
                <input
                  type="text"
                  name="certificato_medico"
                  value={formData.certificato_medico}
                  onChange={handleChange}
                  placeholder="Numero o riferimento certificato"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scadenza Certificato
                </label>
                <input
                  type="date"
                  name="scadenza_certificato"
                  value={formData.scadenza_certificato}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stato Pagamento
                </label>
                <select
                  name="stato_pagamento"
                  value={formData.stato_pagamento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="non_pagato">Non Pagato</option>
                  <option value="pagato">Pagato</option>
                  <option value="parziale">Parziale</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visita Sportiva
                </label>
                <div className="flex items-center h-[42px]">
                  <input
                    type="checkbox"
                    name="visita_sportiva"
                    checked={formData.visita_sportiva}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    {formData.visita_sportiva ? 'Visita effettuata' : 'Visita non effettuata'}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Pagamento
              </label>
              <textarea
                name="note_pagamento"
                value={formData.note_pagamento}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : isEditMode ? 'Aggiorna Tesserato' : 'Salva Tesserato'}
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