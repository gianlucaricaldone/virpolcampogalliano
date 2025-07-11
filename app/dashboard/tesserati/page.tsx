'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { tesseratiApi } from '@/lib/api/tesserati'
import { CACHE_DURATIONS } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Search, Filter, Edit, Trash2, FileText, AlertCircle, UserPlus } from 'lucide-react'
import { Database } from '@/types/database'
import TesseratoForm from '@/components/forms/TesseratoForm'
import AssegnaSquadraForm from '@/components/forms/AssegnaSquadraForm'

type TesseratoConSquadra = Database['public']['Tables']['tesserati']['Row'] & {
  squadra_stagione?: {
    squadra: { nome: string; id: string }
    ruolo_squadra?: string
    numero_maglia?: number
  } | null
  dati_stagionali?: {
    stato_pagamento: string
    note_pagamento?: string | null
    visita_sportiva: boolean
    scadenza_certificato?: string | null
    certificato_medico?: string | null
  } | null
}

type Squadra = Database['public']['Tables']['squadre']['Row']

export default function TesseratiPage() {
  const { profile } = useAuth()
  const { stagioneCorrente } = useSeason()
  const [tesserati, setTesserati] = useState<TesseratoConSquadra[]>([])
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSquadra, setSelectedSquadra] = useState<string>('')
  const [selectedStatoPagamento, setSelectedStatoPagamento] = useState<string>('')
  const [filterVisitaSportiva, setFilterVisitaSportiva] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [selectedTesserato, setSelectedTesserato] = useState<TesseratoConSquadra | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [tesseratoToAssign, setTesseratoToAssign] = useState<TesseratoConSquadra | null>(null)
  const fetchingRef = useRef(false)

  const fetchTesseratiAndSquadre = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = `tesserati_squadre_${stagioneCorrente?.id || 'all'}`
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedData = getCachedQuery<{tesserati: TesseratoConSquadra[], squadre: Squadra[]}>(cacheKey)
      if (cachedData) {
        console.log('[Tesserati] Using cached tesserati and squadre data')
        setTesserati(cachedData.tesserati)
        setSquadre(cachedData.squadre)
        setLoading(false)
        return
      }
    }

    // Check if there's already an ongoing fetch
    if (fetchingRef.current) {
      console.log('[Tesserati] Fetch already in progress, skipping duplicate request')
      return
    }
    
    try {
      fetchingRef.current = true
      setLoading(true)
      
      console.log('[Tesserati] Fetching tesserati and squadre data from API')
      
      // Use centralized API
      const { tesserati, squadre } = await tesseratiApi.getTesseratiAndSquadre(stagioneCorrente?.id)

      // Cache the result
      setCachedQuery(cacheKey, { tesserati, squadre }, CACHE_DURATIONS.TESSERATI)
      console.log('[Tesserati] Data cached for', CACHE_DURATIONS.TESSERATI / 1000, 'seconds')

      setTesserati(tesserati)
      setSquadre(squadre)
    } catch (error) {
      console.error('[Tesserati] Error fetching tesserati and squadre:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [stagioneCorrente?.id])

  useEffect(() => {
    fetchTesseratiAndSquadre()
  }, [fetchTesseratiAndSquadre])


  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo tesserato?')) return
    
    try {
      await tesseratiApi.deleteTesserato(id)
      fetchTesseratiAndSquadre(true) // Force refresh after delete
    } catch (error) {
      console.error('Error deleting tesserato:', error)
      alert('Errore durante l\'eliminazione del tesserato')
    }
  }

  const handleEdit = (tesserato: TesseratoConSquadra) => {
    setSelectedTesserato(tesserato)
    setIsEditMode(true)
    setShowForm(true)
  }

  const handleAssignToSquadra = (tesserato: TesseratoConSquadra) => {
    setTesseratoToAssign(tesserato)
    setShowAssignForm(true)
  }

  const filteredTesserati = tesserati.filter(tesserato => {
    const matchesSearch = searchTerm === '' || 
      `${tesserato.nome} ${tesserato.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tesserato.codice_fiscale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tesserato.codice_cartellino?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSquadra = selectedSquadra === '' || 
      (selectedSquadra === 'senza_squadra' && !tesserato.squadra_stagione) ||
      tesserato.squadra_stagione?.squadra.id === selectedSquadra
    
    const matchesStatoPagamento = selectedStatoPagamento === '' || 
      tesserato.dati_stagionali?.stato_pagamento === selectedStatoPagamento
    
    const matchesVisitaSportiva = filterVisitaSportiva === '' || 
      (filterVisitaSportiva === 'si' && tesserato.dati_stagionali?.visita_sportiva === true) ||
      (filterVisitaSportiva === 'no' && (tesserato.dati_stagionali?.visita_sportiva === false || tesserato.dati_stagionali?.visita_sportiva == null))
    
    return matchesSearch && matchesSquadra && matchesStatoPagamento && matchesVisitaSportiva
  })

  // Use API utility functions
  const getStatusColor = (stato: string) => tesseratiApi.getStatusColor(stato)
  const isCertificateExpiring = (scadenza: string | null | undefined) => tesseratiApi.isCertificateExpiring(scadenza)
  const isCertificateExpired = (scadenza: string | null | undefined) => tesseratiApi.isCertificateExpired(scadenza)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento tesserati...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Tesserati</h1>
          <p className="mt-2 text-gray-600">
            Visualizza e gestisci tutti i tesserati della società
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Tesserato
          </Button>
        )}
      </div>

      {/* Season Info - Solo se non c'è stagione corrente */}
      {!stagioneCorrente && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center text-yellow-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Nessuna stagione corrente impostata. I tesserati vengono mostrati senza associazione a squadre.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Cerca per nome, cognome, CF o codice cartellino..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedSquadra}
                onChange={(e) => setSelectedSquadra(e.target.value)}
              >
                <option value="">Tutte le squadre</option>
                <option value="senza_squadra">Senza squadra</option>
                {squadre.map(squadra => (
                  <option key={squadra.id} value={squadra.id}>
                    {squadra.nome}
                  </option>
                ))}
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedStatoPagamento}
                onChange={(e) => setSelectedStatoPagamento(e.target.value)}
              >
                <option value="">Tutti i pagamenti</option>
                <option value="pagato">Pagato</option>
                <option value="non_pagato">Non Pagato</option>
                <option value="parziale">Parziale</option>
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterVisitaSportiva}
                onChange={(e) => setFilterVisitaSportiva(e.target.value)}
              >
                <option value="">Tutte le visite</option>
                <option value="si">Con visita sportiva</option>
                <option value="no">Senza visita sportiva</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTesserati.map((tesserato) => (
          <Card key={tesserato.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {tesserato.nome} {tesserato.cognome}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {tesserato.squadra_stagione ? (
                      <span>
                        {tesserato.squadra_stagione.squadra.nome}
                        {tesserato.squadra_stagione.numero_maglia && 
                          ` - N°${tesserato.squadra_stagione.numero_maglia}`}
                        {tesserato.squadra_stagione.ruolo_squadra && 
                          ` (${tesserato.squadra_stagione.ruolo_squadra})`}
                      </span>
                    ) : (
                      <span className="text-gray-500">Senza squadra per questa stagione</span>
                    )}
                  </CardDescription>
                </div>
                {(isCertificateExpiring(tesserato.dati_stagionali?.scadenza_certificato) || 
                  isCertificateExpired(tesserato.dati_stagionali?.scadenza_certificato)) && (
                  <AlertCircle className={`h-5 w-5 ${
                    isCertificateExpired(tesserato.dati_stagionali?.scadenza_certificato) 
                      ? 'text-red-500' 
                      : 'text-yellow-500'
                  }`} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tesserato.codice_cartellino && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cartellino:</span>
                    <span className="text-sm text-gray-600">
                      {tesserato.codice_cartellino}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Data di nascita:</span>
                  <span className="text-sm text-gray-600">
                    {tesserato.data_nascita ? new Date(tesserato.data_nascita).toLocaleDateString('it-IT') : 'N/A'}
                  </span>
                </div>
                
                {tesserato.dati_stagionali ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pagamento:</span>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(tesserato.dati_stagionali.stato_pagamento)}`}>
                        {tesserato.dati_stagionali.stato_pagamento.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Visita sportiva:</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tesserato.dati_stagionali.visita_sportiva 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {tesserato.dati_stagionali.visita_sportiva ? 'Effettuata' : 'Non effettuata'}
                      </span>
                    </div>
                    
                    {tesserato.dati_stagionali.scadenza_certificato && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Certificato:</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isCertificateExpired(tesserato.dati_stagionali.scadenza_certificato)
                            ? 'bg-red-100 text-red-800'
                            : isCertificateExpiring(tesserato.dati_stagionali.scadenza_certificato)
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isCertificateExpired(tesserato.dati_stagionali.scadenza_certificato)
                            ? 'Scaduto'
                            : isCertificateExpiring(tesserato.dati_stagionali.scadenza_certificato)
                            ? 'In scadenza'
                            : 'Valido'
                          }
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-2">
                    <span className="text-xs text-gray-500">
                      Nessun dato per questa stagione
                    </span>
                  </div>
                )}
                
                {tesserato.email && (
                  <div className="text-xs text-gray-500 truncate">
                    {tesserato.email}
                  </div>
                )}
              </div>
              
              {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
                <div className="space-y-2 mt-4">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEdit(tesserato)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modifica
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      title="Documenti"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(tesserato.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {stagioneCorrente && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-blue-600 hover:text-blue-700"
                      onClick={() => handleAssignToSquadra(tesserato)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      {tesserato.squadra_stagione ? 'Modifica Squadra' : 'Assegna a Squadra'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTesserati.length === 0 && searchTerm && (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun tesserato trovato per "{searchTerm}"</p>
          </CardContent>
        </Card>
      )}

      {tesserati.length === 0 && !searchTerm && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun tesserato registrato</p>
            {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
              <Button 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Registra il primo tesserato
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <TesseratoForm
          tesserato={selectedTesserato}
          isEditMode={isEditMode}
          onClose={() => {
            setShowForm(false)
            setSelectedTesserato(null)
            setIsEditMode(false)
          }}
          onSuccess={() => {
            fetchTesseratiAndSquadre(true) // Force refresh after create/edit
            setShowForm(false)
            setSelectedTesserato(null)
            setIsEditMode(false)
          }}
        />
      )}

      {showAssignForm && tesseratoToAssign && (
        <AssegnaSquadraForm
          tesserato={tesseratoToAssign}
          onClose={() => {
            setShowAssignForm(false)
            setTesseratoToAssign(null)
          }}
          onSuccess={() => {
            fetchTesseratiAndSquadre(true) // Force refresh after assign
            setShowAssignForm(false)
            setTesseratoToAssign(null)
          }}
        />
      )}
    </div>
  )
}