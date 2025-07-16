'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useSeason } from '@/contexts/SeasonContext'
// import { useOrganization } from '@/contexts/OrganizationContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X } from 'lucide-react'
import { Database } from '@/types/database'

interface TesseratoFormProps {
  onClose: () => void
  onSuccess: () => void
  tesserato?: Database['public']['Tables']['tesserati']['Row'] | null
  isEditMode?: boolean
}

type Squadra = Database['public']['Tables']['squadre']['Row']

export default function TesseratoForm({ onClose, onSuccess, tesserato, isEditMode = false }: TesseratoFormProps) {
  const { stagioneCorrente } = useSeason()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [selectedSquadra, setSelectedSquadra] = useState<string>('')
  const [formData, setFormData] = useState({
    nome: tesserato?.nome || '',
    cognome: tesserato?.cognome || '',
    data_nascita: tesserato?.data_nascita || '',
    codice_fiscale: tesserato?.codice_fiscale || '',
    codice_cartellino: tesserato?.codice_cartellino || '',
    email: tesserato?.email || '',
    telefono: tesserato?.telefono || '',
    indirizzo: tesserato?.indirizzo || '',
    citta: tesserato?.citta || '',
    cap: tesserato?.cap || '',
    documento_identita: tesserato?.documento_identita || ''
  })
  
  const [datiStagionali, setDatiStagionali] = useState({
    stato_pagamento: 'non_pagato' as const,
    visita_sportiva: false,
    scadenza_certificato: '',
    note_pagamento: ''
  })

  const supabase = createClient()

  useEffect(() => {
    if (!isEditMode && stagioneCorrente?.id) {
      fetchSquadre()
    }
  }, [stagioneCorrente?.id, isEditMode])

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSubmit = {
        nome: formData.nome,
        cognome: formData.cognome,
        data_nascita: formData.data_nascita || null,
        codice_fiscale: formData.codice_fiscale || null,
        codice_cartellino: formData.codice_cartellino || null,
        email: formData.email || null,
        telefono: formData.telefono || null,
        indirizzo: formData.indirizzo || null,
        citta: formData.citta || null,
        cap: formData.cap || null,
        documento_identita: formData.documento_identita || null,
        organization_id: profile?.organization_id
      }

      if (isEditMode && tesserato) {
        const { error } = await supabase
          .from('tesserati')
          .update(dataToSubmit)
          .eq('id', tesserato.id)

        if (error) throw error
      } else {
        // Crea il tesserato
        const { data: newTesserato, error: tesseratoError } = await supabase
          .from('tesserati')
          .insert(dataToSubmit)
          .select()
          .single()

        if (tesseratoError) throw tesseratoError

        // Se è stata selezionata una squadra e c'è una stagione corrente, assegna il tesserato
        if (selectedSquadra && stagioneCorrente?.id && newTesserato) {
          const { error: assignmentError } = await supabase
            .from('tesserati_squadre_stagioni')
            .insert({
              tesserato_id: newTesserato.id,
              squadra_id: selectedSquadra,
              stagione_id: stagioneCorrente.id
            })

          if (assignmentError) {
            console.error('Error assigning to squadra:', assignmentError)
            // Non blocchiamo l'operazione se l'assegnazione fallisce
          }
        }

        // Crea i dati stagionali se c'è una stagione corrente
        if (stagioneCorrente?.id && newTesserato) {
          const { error: datiStagionaliError } = await supabase
            .from('tesserati_dati_stagionali')
            .insert({
              tesserato_id: newTesserato.id,
              stagione_id: stagioneCorrente.id,
              stato_pagamento: datiStagionali.stato_pagamento,
              visita_sportiva: datiStagionali.visita_sportiva,
              scadenza_certificato: datiStagionali.scadenza_certificato || null,
              note_pagamento: datiStagionali.note_pagamento || null
            })

          if (datiStagionaliError) {
            console.error('Error creating dati stagionali:', datiStagionaliError)
            // Non blocchiamo l'operazione se la creazione fallisce
          }
        }
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

  const handleDatiStagionaliChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setDatiStagionali(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditMode ? 'Modifica Anagrafica Tesserato' : 'Nuovo Tesserato'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {isEditMode && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center text-blue-800 text-sm">
                <span className="font-medium">ℹ️ Nota:</span>
                <span className="ml-2">
                  Questo form gestisce solo i dati anagrafici. Per modificare squadra, pagamenti e certificati medici, utilizza il pulsante "Assegna a Squadra" nella lista tesserati.
                </span>
              </div>
            </div>
          )}
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

              {!isEditMode && stagioneCorrente && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assegna a Squadra (opzionale)
                  </label>
                  <select
                    value={selectedSquadra}
                    onChange={(e) => setSelectedSquadra(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Nessuna squadra (solo tesseramento)</option>
                    {squadre.map(squadra => (
                      <option key={squadra.id} value={squadra.id}>
                        {squadra.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Stagione: {stagioneCorrente.nome}
                  </p>
                </div>
              )}

              {!isEditMode && stagioneCorrente && (
                <>
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6 border-t pt-6">
                      Dati Stagionali
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stato Pagamento
                    </label>
                    <select
                      name="stato_pagamento"
                      value={datiStagionali.stato_pagamento}
                      onChange={handleDatiStagionaliChange}
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
                      Visita Medica
                    </label>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visita_sportiva"
                          value="true"
                          checked={datiStagionali.visita_sportiva === true}
                          onChange={(e) => setDatiStagionali(prev => ({ ...prev, visita_sportiva: true }))}
                          className="mr-2"
                        />
                        Effettuata
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="visita_sportiva"
                          value="false"
                          checked={datiStagionali.visita_sportiva === false}
                          onChange={(e) => setDatiStagionali(prev => ({ ...prev, visita_sportiva: false }))}
                          className="mr-2"
                        />
                        Non Effettuata
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scadenza Certificato (opzionale)
                    </label>
                    <input
                      type="date"
                      name="scadenza_certificato"
                      value={datiStagionali.scadenza_certificato}
                      onChange={handleDatiStagionaliChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note Pagamento (opzionale)
                    </label>
                    <input
                      type="text"
                      name="note_pagamento"
                      value={datiStagionali.note_pagamento}
                      onChange={handleDatiStagionaliChange}
                      placeholder="Note sul pagamento..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

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