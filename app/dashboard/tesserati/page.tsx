'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Search, Filter, Edit, Trash2, FileText, AlertCircle } from 'lucide-react'
import { Database } from '@/types/database'
import TesseratoForm from '@/components/forms/TesseratoForm'

type Tesserato = Database['public']['Tables']['tesserati']['Row'] & {
  squadre?: { nome: string }
}

type Squadra = Database['public']['Tables']['squadre']['Row']

export default function TesseratiPage() {
  const { profile } = useAuth()
  const [tesserati, setTesserati] = useState<Tesserato[]>([])
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSquadra, setSelectedSquadra] = useState<string>('')
  const [selectedStatoPagamento, setSelectedStatoPagamento] = useState<string>('')
  const [filterVisitaSportiva, setFilterVisitaSportiva] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [selectedTesserato, setSelectedTesserato] = useState<Tesserato | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTesserati()
    fetchSquadre()
  }, [])

  const fetchTesserati = async () => {
    try {
      const { data, error } = await supabase
        .from('tesserati')
        .select(`
          *,
          squadre:squadra_id (nome)
        `)
        .order('cognome', { ascending: true })

      if (error) throw error
      setTesserati(data || [])
    } catch (error) {
      console.error('Error fetching tesserati:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo tesserato?')) return
    
    try {
      const { error } = await supabase
        .from('tesserati')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      fetchTesserati()
    } catch (error) {
      console.error('Error deleting tesserato:', error)
      alert('Errore durante l\'eliminazione del tesserato')
    }
  }

  const handleEdit = (tesserato: Tesserato) => {
    setSelectedTesserato(tesserato)
    setIsEditMode(true)
    setShowForm(true)
  }

  const filteredTesserati = tesserati.filter(tesserato => {
    const matchesSearch = searchTerm === '' || 
      `${tesserato.nome} ${tesserato.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tesserato.codice_fiscale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tesserato.codice_cartellino?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSquadra = selectedSquadra === '' || tesserato.squadra_id === selectedSquadra
    
    const matchesStatoPagamento = selectedStatoPagamento === '' || tesserato.stato_pagamento === selectedStatoPagamento
    
    const matchesVisitaSportiva = filterVisitaSportiva === '' || 
      (filterVisitaSportiva === 'si' && tesserato.visita_sportiva === true) ||
      (filterVisitaSportiva === 'no' && (tesserato.visita_sportiva === false || tesserato.visita_sportiva === null))
    
    return matchesSearch && matchesSquadra && matchesStatoPagamento && matchesVisitaSportiva
  })

  const getStatusColor = (stato: string) => {
    switch (stato) {
      case 'pagato':
        return 'bg-green-100 text-green-800'
      case 'in_sospeso':
        return 'bg-yellow-100 text-yellow-800'
      case 'non_pagato':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const isCertificateExpiring = (scadenza: string | null) => {
    if (!scadenza) return false
    const today = new Date()
    const expiry = new Date(scadenza)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isCertificateExpired = (scadenza: string | null) => {
    if (!scadenza) return false
    const today = new Date()
    const expiry = new Date(scadenza)
    return expiry < today
  }

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
                    {tesserato.squadre?.nome || 'Squadra non assegnata'}
                  </CardDescription>
                </div>
                {(isCertificateExpiring(tesserato.scadenza_certificato) || 
                  isCertificateExpired(tesserato.scadenza_certificato)) && (
                  <AlertCircle className={`h-5 w-5 ${
                    isCertificateExpired(tesserato.scadenza_certificato) 
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
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Pagamento:</span>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(tesserato.stato_pagamento)}`}>
                    {tesserato.stato_pagamento.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Visita sportiva:</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tesserato.visita_sportiva 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {tesserato.visita_sportiva ? 'Effettuata' : 'Non effettuata'}
                  </span>
                </div>
                
                {tesserato.scadenza_certificato && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Certificato:</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isCertificateExpired(tesserato.scadenza_certificato)
                        ? 'bg-red-100 text-red-800'
                        : isCertificateExpiring(tesserato.scadenza_certificato)
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {isCertificateExpired(tesserato.scadenza_certificato)
                        ? 'Scaduto'
                        : isCertificateExpiring(tesserato.scadenza_certificato)
                        ? 'In scadenza'
                        : 'Valido'
                      }
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
                <div className="flex gap-2 mt-4">
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
            fetchTesserati()
            setShowForm(false)
            setSelectedTesserato(null)
            setIsEditMode(false)
          }}
        />
      )}
    </div>
  )
}