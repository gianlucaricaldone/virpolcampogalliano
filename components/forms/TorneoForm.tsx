'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Trophy, Calendar, Users, MapPin, Mail, Phone, Image as ImageIcon } from 'lucide-react'
import { Database } from '@/types/database'

type Torneo = Database['public']['Tables']['tornei']['Row']

interface TorneoFormProps {
  onClose: () => void
  onSuccess: () => void
  torneo?: Torneo | null
  isEditMode?: boolean
}

export default function TorneoForm({ onClose, onSuccess, torneo, isEditMode = false }: TorneoFormProps) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    nome: torneo?.nome || '',
    descrizione: torneo?.descrizione || '',
    data_inizio: torneo?.data_inizio || '',
    data_fine: torneo?.data_fine || '',
    stato: torneo?.stato || 'pianificato',
    attivo: torneo?.attivo !== undefined ? torneo.attivo : true,
    iscrizioni_aperte: torneo?.iscrizioni_aperte !== undefined ? torneo.iscrizioni_aperte : false,
    costo_iscrizione: torneo?.costo_iscrizione || '',
    numero_squadre_max: torneo?.numero_squadre_max || '',
    luogo: torneo?.luogo || '',
    contatto_email: torneo?.contatto_email || '',
    contatto_telefono: torneo?.contatto_telefono || '',
    immagine_copertina: torneo?.immagine_copertina || '',
    regolamento: torneo?.regolamento ? JSON.stringify(torneo.regolamento, null, 2) : ''
  })

  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validazione base
      if (!formData.nome || !formData.data_inizio || !formData.data_fine) {
        alert('Nome, data inizio e data fine sono obbligatori')
        setLoading(false)
        return
      }

      // Validazione date
      const startDate = new Date(formData.data_inizio)
      const endDate = new Date(formData.data_fine)
      if (endDate < startDate) {
        alert('La data di fine deve essere successiva alla data di inizio')
        setLoading(false)
        return
      }

      const dataToSubmit = {
        nome: formData.nome,
        descrizione: formData.descrizione || null,
        data_inizio: formData.data_inizio,
        data_fine: formData.data_fine,
        stato: formData.stato,
        attivo: formData.attivo,
        iscrizioni_aperte: formData.iscrizioni_aperte,
        costo_iscrizione: formData.costo_iscrizione ? parseFloat(formData.costo_iscrizione.toString()) : null,
        numero_squadre_max: formData.numero_squadre_max ? parseInt(formData.numero_squadre_max.toString()) : null,
        luogo: formData.luogo || null,
        contatto_email: formData.contatto_email || null,
        contatto_telefono: formData.contatto_telefono || null,
        immagine_copertina: formData.immagine_copertina || null,
        regolamento: formData.regolamento ? JSON.parse(formData.regolamento) : null,
        organization_id: profile?.organization_id || undefined
      }

      if (isEditMode && torneo) {
        const { error } = await supabase
          .from('tornei')
          .update(dataToSubmit)
          .eq('id', torneo.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tornei')
          .insert(dataToSubmit)

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} torneo:`, error)
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        alert('Errore nel formato del regolamento JSON')
      } else {
        alert(`Errore durante ${isEditMode ? 'l\'aggiornamento' : 'la creazione'} del torneo`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            {isEditMode ? 'Modifica Torneo' : 'Nuovo Torneo'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informazioni Base */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Informazioni Generali</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Torneo *
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. Torneo Primavera 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Data Inizio *
                  </label>
                  <input
                    type="date"
                    name="data_inizio"
                    value={formData.data_inizio}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Data Fine *
                  </label>
                  <input
                    type="date"
                    name="data_fine"
                    value={formData.data_fine}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Luogo
                  </label>
                  <input
                    type="text"
                    name="luogo"
                    value={formData.luogo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. Centro Sportivo Virpol"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stato
                  </label>
                  <select
                    name="stato"
                    value={formData.stato}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pianificato">Pianificato</option>
                    <option value="in_corso">In Corso</option>
                    <option value="concluso">Concluso</option>
                    <option value="annullato">Annullato</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    name="descrizione"
                    value={formData.descrizione}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Descrizione del torneo..."
                  />
                </div>
              </div>
            </div>

            {/* Gestione Squadre e Costi */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Gestione Iscrizioni</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Users className="inline h-4 w-4 mr-1" />
                    Numero Max Squadre
                  </label>
                  <input
                    type="number"
                    name="numero_squadre_max"
                    value={formData.numero_squadre_max}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. 16"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Iscrizione (€)
                  </label>
                  <input
                    type="number"
                    name="costo_iscrizione"
                    value={formData.costo_iscrizione}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. 50.00"
                  />
                </div>
              </div>
            </div>

            {/* Contatti */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Contatti</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email Contatto
                  </label>
                  <input
                    type="email"
                    name="contatto_email"
                    value={formData.contatto_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. tornei@virpolcampogalliano.it"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Telefono Contatto
                  </label>
                  <input
                    type="tel"
                    name="contatto_telefono"
                    value={formData.contatto_telefono}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="es. 059 123456"
                  />
                </div>
              </div>
            </div>

            {/* Immagine e Media */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Media</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ImageIcon className="inline h-4 w-4 mr-1" />
                  URL Immagine Copertina
                </label>
                <input
                  type="url"
                  name="immagine_copertina"
                  value={formData.immagine_copertina}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://esempio.com/immagine.jpg"
                />
              </div>
            </div>

            {/* Flags */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Visibilità e Stato</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="attivo"
                    checked={formData.attivo}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    <strong>Torneo Attivo</strong> - Visibile nella landing page
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="iscrizioni_aperte"
                    checked={formData.iscrizioni_aperte}
                    onChange={handleChange}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    <strong>Iscrizioni Aperte</strong> - Le squadre possono iscriversi
                  </label>
                </div>
              </div>
            </div>

            {/* Regolamento */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Regolamento (JSON)</h3>
              <textarea
                name="regolamento"
                value={formData.regolamento}
                onChange={handleChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder='{"regole": ["Regola 1", "Regola 2"], "premi": {"primo": "Trofeo", "secondo": "Medaglia"}}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Inserisci il regolamento in formato JSON. Lascia vuoto se non necessario.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Salvando...' : isEditMode ? 'Aggiorna Torneo' : 'Salva Torneo'}
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