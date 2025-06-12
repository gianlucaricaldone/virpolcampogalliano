'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/contexts/SeasonContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Users } from 'lucide-react'
import { Database } from '@/types/database'

type Tesserato = Database['public']['Tables']['tesserati']['Row']
type Squadra = Database['public']['Tables']['squadre']['Row']

interface AssegnaSquadraFormProps {
  tesserato: Tesserato
  onClose: () => void
  onSuccess: () => void
}

export default function AssegnaSquadraForm({ tesserato, onClose, onSuccess }: AssegnaSquadraFormProps) {
  const { stagioneCorrente } = useSeason()
  const [loading, setLoading] = useState(false)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [currentAssignment, setCurrentAssignment] = useState<any>(null)
  const [currentSeasonData, setCurrentSeasonData] = useState<any>(null)
  const [formData, setFormData] = useState({
    squadra_id: '',
    ruolo_squadra: '',
    numero_maglia: '',
    stato_pagamento: 'non_pagato',
    note_pagamento: '',
    visita_sportiva: false,
    scadenza_certificato: '',
    certificato_medico: ''
  })

  const supabase = createClient()

  useEffect(() => {
    if (stagioneCorrente?.id) {
      fetchSquadre()
      fetchCurrentAssignment()
      fetchSeasonData()
    }
  }, [stagioneCorrente?.id])

  const fetchSquadre = async () => {
    if (!stagioneCorrente?.id) return

    try {
      const { data, error } = await supabase
        .from('squadre')
        .select('*')
        .eq('stagione_id', stagioneCorrente.id)
        .order('nome', { ascending: true })

      if (error) throw error
      setSquadre(data || [])
    } catch (error) {
      console.error('Error fetching squadre:', error)
    }
  }

  const fetchCurrentAssignment = async () => {
    if (!stagioneCorrente?.id) return

    try {
      const { data, error } = await supabase
        .from('tesserati_squadre_stagioni')
        .select(`
          *,
          squadre:squadra_id (
            id,
            nome
          )
        `)
        .eq('tesserato_id', tesserato.id)
        .eq('stagione_id', stagioneCorrente.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found
      
      if (data) {
        setCurrentAssignment(data)
        setFormData(prev => ({
          ...prev,
          squadra_id: data.squadra_id,
          ruolo_squadra: data.ruolo_squadra || '',
          numero_maglia: data.numero_maglia?.toString() || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching current assignment:', error)
    }
  }

  const fetchSeasonData = async () => {
    if (!stagioneCorrente?.id) return

    try {
      const { data, error } = await supabase
        .from('tesserati_dati_stagionali')
        .select('*')
        .eq('tesserato_id', tesserato.id)
        .eq('stagione_id', stagioneCorrente.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found
      
      if (data) {
        setCurrentSeasonData(data)
        setFormData(prev => ({
          ...prev,
          stato_pagamento: data.stato_pagamento || 'non_pagato',
          note_pagamento: data.note_pagamento || '',
          visita_sportiva: data.visita_sportiva || false,
          scadenza_certificato: data.scadenza_certificato || '',
          certificato_medico: data.certificato_medico || ''
        }))
      }
    } catch (error) {
      console.error('Error fetching season data:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stagioneCorrente?.id) return
    
    setLoading(true)

    try {
      // Gestisci assegnazione squadra
      if (formData.squadra_id) {
        const assignmentData = {
          tesserato_id: tesserato.id,
          squadra_id: formData.squadra_id,
          stagione_id: stagioneCorrente.id,
          ruolo_squadra: formData.ruolo_squadra || null,
          numero_maglia: formData.numero_maglia ? parseInt(formData.numero_maglia) : null
        }

        if (currentAssignment) {
          // Aggiorna esistente
          const { error } = await supabase
            .from('tesserati_squadre_stagioni')
            .update(assignmentData)
            .eq('id', currentAssignment.id)

          if (error) throw error
        } else {
          // Crea nuovo
          const { error } = await supabase
            .from('tesserati_squadre_stagioni')
            .insert(assignmentData)

          if (error) throw error
        }
      }

      // Gestisci dati stagionali
      const seasonalData = {
        tesserato_id: tesserato.id,
        stagione_id: stagioneCorrente.id,
        stato_pagamento: formData.stato_pagamento,
        note_pagamento: formData.note_pagamento || null,
        visita_sportiva: formData.visita_sportiva,
        scadenza_certificato: formData.scadenza_certificato || null,
        certificato_medico: formData.certificato_medico || null
      }

      if (currentSeasonData) {
        // Aggiorna esistente
        const { error } = await supabase
          .from('tesserati_dati_stagionali')
          .update(seasonalData)
          .eq('id', currentSeasonData.id)

        if (error) throw error
      } else {
        // Crea nuovo
        const { error } = await supabase
          .from('tesserati_dati_stagionali')
          .insert(seasonalData)

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving assignment:', error)
      alert('Errore durante il salvataggio dell\'assegnazione')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAssignment = async () => {
    if (!currentAssignment) return
    
    if (!confirm('Sei sicuro di voler rimuovere l\'assegnazione alla squadra?')) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('tesserati_squadre_stagioni')
        .delete()
        .eq('id', currentAssignment.id)

      if (error) throw error

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert('Errore durante la rimozione dell\'assegnazione')
    } finally {
      setLoading(false)
    }
  }

  if (!stagioneCorrente) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Assegna a Squadra</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                Nessuna stagione corrente impostata. 
                Non è possibile assegnare tesserati alle squadre.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Gestione Tesserato - Stagione {stagioneCorrente.nome}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="font-semibold">{tesserato.nome} {tesserato.cognome}</h3>
            <p className="text-sm text-gray-600">Stagione: {stagioneCorrente.nome}</p>
            {currentAssignment && (
              <p className="text-sm text-blue-600 mt-1">
                Attualmente assegnato a: {currentAssignment.squadre?.nome}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sezione Squadra */}
            <div className="border-b border-gray-200 pb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Assegnazione Squadra</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Squadra
                  </label>
                  <select
                    value={formData.squadra_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, squadra_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nessuna squadra (solo tesseramento)</option>
                    {squadre.map(squadra => (
                      <option key={squadra.id} value={squadra.id}>
                        {squadra.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.squadra_id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ruolo in squadra
                      </label>
                      <input
                        type="text"
                        value={formData.ruolo_squadra}
                        onChange={(e) => setFormData(prev => ({ ...prev, ruolo_squadra: e.target.value }))}
                        placeholder="es. Capitano, Portiere..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Numero maglia
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={formData.numero_maglia}
                        onChange={(e) => setFormData(prev => ({ ...prev, numero_maglia: e.target.value }))}
                        placeholder="es. 10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sezione Dati Stagionali */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Dati Stagionali</h4>
              
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stato Pagamento
                  </label>
                  <select
                    value={formData.stato_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, stato_pagamento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="non_pagato">Non Pagato</option>
                    <option value="pagato">Pagato</option>
                    <option value="parziale">Parziale</option>
                    <option value="in_sospeso">In Sospeso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Pagamento
                  </label>
                  <textarea
                    value={formData.note_pagamento}
                    onChange={(e) => setFormData(prev => ({ ...prev, note_pagamento: e.target.value }))}
                    rows={2}
                    placeholder="Note sui pagamenti..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visita Sportiva
                  </label>
                  <div className="flex items-center h-[42px]">
                    <input
                      type="checkbox"
                      checked={formData.visita_sportiva}
                      onChange={(e) => setFormData(prev => ({ ...prev, visita_sportiva: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">
                      {formData.visita_sportiva ? 'Visita effettuata' : 'Visita non effettuata'}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificato Medico
                  </label>
                  <input
                    type="text"
                    value={formData.certificato_medico}
                    onChange={(e) => setFormData(prev => ({ ...prev, certificato_medico: e.target.value }))}
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
                    value={formData.scadenza_certificato}
                    onChange={(e) => setFormData(prev => ({ ...prev, scadenza_certificato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Salvando...' : 'Salva Dati Stagionali'}
              </Button>
              
              {currentAssignment && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveAssignment}
                  disabled={loading}
                  className="px-3"
                >
                  Rimuovi da Squadra
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}