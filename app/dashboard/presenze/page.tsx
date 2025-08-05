'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Check, X, Filter, Search, Users, BarChart3, FileText, Clock, UserCheck, Trash2 } from 'lucide-react'
import { Database } from '@/types/database'
import { DEFAULT_ORGANIZATION_ID, ATTENDANCE_TYPES, STATISTICS_PERIODS } from '@/lib/constants'

type Presenza = Database['public']['Tables']['presenze']['Row'] & {
  tesserati?: { nome: string; cognome: string; squadra_id: string }
}

type TipoAttivita = keyof typeof ATTENDANCE_TYPES

type StatistichePeriodo = keyof typeof STATISTICS_PERIODS

export default function PresenzePage() {
  const { profile, hasAnyRole } = useAuth()
  const { stagioneCorrente } = useSeason()
  const [presenze, setPresenze] = useState<Presenza[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedType, setSelectedType] = useState<TipoAttivita>('ALLENAMENTO')
  const [activeTab, setActiveTab] = useState<'presenze' | 'statistiche' | 'report'>('presenze')
  const [squadre, setSquadre] = useState<any[]>([])
  const [selectedSquadra, setSelectedSquadra] = useState<string>('all')
  const [defaultSquadraSet, setDefaultSquadraSet] = useState(false)
  const [tesserati, setTesserati] = useState<any[]>([])
  const [selectedTesserati, setSelectedTesserati] = useState<Set<string>>(new Set())
  const [report, setReport] = useState('')
  const [statistichePeriodo, setStatistichePeriodo] = useState<StatistichePeriodo>('SETTIMANALE')
  const supabase = createClient()

  useEffect(() => {
    if (stagioneCorrente?.id) {
      fetchSquadre()
    } else {
      setLoading(false)
    }
  }, [stagioneCorrente?.id, profile?.squadra_id])

  useEffect(() => {
    if (activeTab === 'presenze') {
      fetchPresenze()
    } else if (activeTab === 'report') {
      fetchTodayReport()
    }
  }, [selectedDate, selectedType, selectedSquadra, activeTab])
  

  useEffect(() => {
    if (selectedSquadra !== 'all') {
      fetchTesserati()
    }
  }, [selectedSquadra])

  const fetchSquadre = async () => {
    if (!stagioneCorrente?.id) {
      setLoading(false)
      return
    }
    
    try {
      let query = supabase
        .from('squadre')
        .select('*')
        .eq('stagione_id', stagioneCorrente.id)
        .order('categoria')

      // Se l'utente è un allenatore o vice_allenatore, filtra solo le sue squadre
      if (hasAnyRole(['allenatore', 'vice_allenatore']) && profile?.squadra_id && profile.squadra_id.length > 0) {
        query = query.in('id', profile.squadra_id)
      }

      const { data, error } = await query

      if (error) throw error
      
      const squadreData = data || []
      setSquadre(squadreData)
      
      // Se l'utente è un allenatore e non è stata ancora impostata una squadra di default
      if (hasAnyRole(['allenatore', 'vice_allenatore']) && !defaultSquadraSet && squadreData.length > 0) {
        setSelectedSquadra(squadreData[0].id)
        setDefaultSquadraSet(true)
      }
    } catch (error) {
      console.error('Error fetching squadre:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTesserati = async () => {
    if (!stagioneCorrente?.id) return
    
    try {
      // Usa la tabella di relazione tesserati_squadre_stagioni per ottenere i tesserati della squadra nella stagione corrente
      const { data, error } = await supabase
        .from('tesserati_squadre_stagioni')
        .select(`
          tesserato_id,
          tesserati:tesserato_id (
            id,
            nome,
            cognome,
            stato
          )
        `)
        .eq('squadra_id', selectedSquadra)
        .eq('stagione_id', stagioneCorrente.id)

      if (error) throw error
      
      // Estrai i tesserati e filtra quelli attivi, poi ordina per cognome
      const tesseratiData = data || []
      const tesseratiAttivi = tesseratiData
        .map(item => {
          const tesserato = item.tesserati
          if (Array.isArray(tesserato)) {
            return tesserato[0] || null
          }
          return tesserato
        })
        .filter((t): t is { id: string; nome: string; cognome: string; stato: boolean } => 
          t !== null && typeof t === 'object' && 'cognome' in t
        )
        .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''))
      
      setTesserati(tesseratiAttivi)
    } catch (error) {
      console.error('Error fetching tesserati:', error)
    }
  }

  const fetchPresenze = async () => {
    if (!stagioneCorrente?.id) {
      setLoading(false)
      return
    }
    
    try {
      // Query base per presenze
      let query = supabase
        .from('presenze')
        .select(`
          *,
          tesserati:tesserato_id (id, nome, cognome)
        `)
        .eq('data', selectedDate)
        .eq('stagione_id', stagioneCorrente.id)
        .eq('tipo', ATTENDANCE_TYPES[selectedType])
        .order('created_at', { ascending: false })

      // Se è selezionata una squadra specifica, filtra per squadra_id nella tabella presenze
      if (selectedSquadra !== 'all') {
        query = query.eq('squadra_id', selectedSquadra)
      }

      const { data, error } = await query

      if (error) throw error
      
      setPresenze(data || [])
    } catch (error) {
      console.error('Error fetching presenze:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTodayReport = async () => {
    if (!profile?.id) return
    
    try {
      const { data, error } = await supabase
        .from('report_allenatori')
        .select('*')
        .eq('allenatore_id', profile.id)
        .eq('data', selectedDate)
        .eq('tipo_attivita', selectedType)
        .single()

      if (data) {
        setReport(data.report)
      }
    } catch (error) {
      // Report non trovato, va bene
      setReport('')
    }
  }

  const togglePresenza = async (presenzaId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('presenze')
        .update({ presente: !currentStatus })
        .eq('id', presenzaId)

      if (error) throw error
      
      setPresenze(prev => prev.map(p => 
        p.id === presenzaId ? { ...p, presente: !currentStatus } : p
      ))
    } catch (error) {
      console.error('Error updating presenza:', error)
    }
  }

  const handleBulkPresence = async () => {
    if (tesserati.length === 0) return

    try {
      // Prima, ottieni tutte le presenze esistenti in una sola query
      const { data: existingPresenze } = await supabase
        .from('presenze')
        .select('id, tesserato_id')
        .eq('data', selectedDate)
        .eq('tipo', ATTENDANCE_TYPES[selectedType])
        .eq('squadra_id', selectedSquadra)
        .in('tesserato_id', tesserati.map(t => t.id))

      const existingMap = new Map(
        (existingPresenze || []).map(p => [p.tesserato_id, p.id])
      )

      // Prepara i dati per insert e update
      const toInsert: any[] = []
      const toUpdatePresent: string[] = []
      const toUpdateAbsent: string[] = []

      tesserati.forEach(tesserato => {
        const isPresent = selectedTesserati.has(tesserato.id)
        const existingId = existingMap.get(tesserato.id)

        if (existingId) {
          // Aggiungi agli array di update
          if (isPresent) {
            toUpdatePresent.push(existingId)
          } else {
            toUpdateAbsent.push(existingId)
          }
        } else {
          // Prepara per insert
          toInsert.push({
            tesserato_id: tesserato.id,
            data: selectedDate,
            tipo: ATTENDANCE_TYPES[selectedType],
            presente: isPresent,
            squadra_id: selectedSquadra !== 'all' ? selectedSquadra : null,
            stagione_id: stagioneCorrente?.id,
            organization_id: DEFAULT_ORGANIZATION_ID
          })
        }
      })

      // Esegui le operazioni in batch
      const operations = []

      // Insert batch
      if (toInsert.length > 0) {
        operations.push(
          supabase.from('presenze').insert(toInsert)
        )
      }

      // Update presenti batch
      if (toUpdatePresent.length > 0) {
        operations.push(
          supabase
            .from('presenze')
            .update({ presente: true })
            .in('id', toUpdatePresent)
        )
      }

      // Update assenti batch
      if (toUpdateAbsent.length > 0) {
        operations.push(
          supabase
            .from('presenze')
            .update({ presente: false })
            .in('id', toUpdateAbsent)
        )
      }

      // Esegui tutte le operazioni
      const results = await Promise.all(operations)
      
      // Controlla errori
      const errors = results.filter(r => r.error).map(r => r.error)
      if (errors.length > 0) {
        throw new Error(errors.map(e => e?.message).join(', '))
      }

      setSelectedTesserati(new Set())
      fetchPresenze()
      alert(`✅ Presenze registrate con successo!\n${selectedTesserati.size} presenti, ${tesserati.length - selectedTesserati.size} assenti`)
    } catch (error) {
      console.error('Error updating bulk presences:', error)
      alert('Errore durante l\'aggiornamento delle presenze: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'))
    }
  }

  const handleDeleteAllPresences = async () => {
    if (!stagioneCorrente?.id) return
    
    // Una sola conferma
    const squadraNome = squadre.find(s => s.id === selectedSquadra)?.nome || 'Squadra sconosciuta'
    const dataFormatted = new Date(selectedDate).toLocaleDateString('it-IT')
    
    const confirm_delete = confirm(
      `Eliminare TUTTE le ${presenze.length} presenze per:\n\n` +
      `📅 Data: ${dataFormatted}\n` +
      `👥 Squadra: ${squadraNome}\n` +
      `🏃 Attività: ${selectedType}\n\n` +
      `⚠️ Questa azione non può essere annullata!`
    )
    
    if (!confirm_delete) return

    try {
      setLoading(true)
      
      console.log('=== DEBUG ELIMINAZIONE PRESENZE ===')
      console.log('Filtri utilizzati:', {
        data: selectedDate,
        tipo: selectedType,
        squadra_id: selectedSquadra,
        stagione_id: stagioneCorrente.id
      })
      
      console.log('Presenze attualmente visualizzate:', presenze.length)
      console.log('Dettagli presenze visualizzate:', presenze.map(p => ({
        id: p.id,
        data: p.data,
        tipo: p.tipo,
        squadra_id: p.squadra_id,
        stagione_id: p.stagione_id,
        tesserato: p.tesserati?.cognome + ' ' + p.tesserati?.nome
      })))
      
      // Prima ottieni TUTTE le presenze con questi filtri per debug
      const { data: presenzeToDelete, error: fetchError } = await supabase
        .from('presenze')
        .select('*')
        .eq('data', selectedDate)
        .eq('tipo', ATTENDANCE_TYPES[selectedType])
        .eq('squadra_id', selectedSquadra)
        .eq('stagione_id', stagioneCorrente.id)
      
      if (fetchError) {
        console.error('Error fetching presences to delete:', fetchError)
        throw fetchError
      }
      
      console.log('Presenze trovate dal database con i filtri:', presenzeToDelete?.length || 0)
      console.log('Dettagli presenze dal DB:', presenzeToDelete?.map(p => ({
        id: p.id,
        data: p.data,
        tipo: p.tipo,
        squadra_id: p.squadra_id,
        stagione_id: p.stagione_id
      })))
      
      if (!presenzeToDelete || presenzeToDelete.length === 0) {
        console.log('PROBLEMA: Nessuna presenza trovata con i filtri specificati')
        console.log('Verifica manuale:')
        
        // Prova query senza stagione_id
        const { data: testSenzaStagione } = await supabase
          .from('presenze')
          .select('*')
          .eq('data', selectedDate)
          .eq('tipo', ATTENDANCE_TYPES[selectedType])
          .eq('squadra_id', selectedSquadra)
        
        console.log('Presenze senza filtro stagione_id:', testSenzaStagione?.length || 0)
        
        // Prova query senza squadra_id
        const { data: testSenzaSquadra } = await supabase
          .from('presenze')
          .select('*')
          .eq('data', selectedDate)
          .eq('tipo', ATTENDANCE_TYPES[selectedType])
          .eq('stagione_id', stagioneCorrente.id)
        
        console.log('Presenze senza filtro squadra_id:', testSenzaSquadra?.length || 0)
        
        alert('❌ Nessuna presenza trovata con i filtri specificati. Controlla la console per debug.')
        return
      }
      
      console.log('Procedo con eliminazione di', presenzeToDelete.length, 'presenze')
      
      // Elimina usando gli ID specifici invece dei filtri
      const idsToDelete = presenzeToDelete.map(p => p.id)
      console.log('IDs da eliminare:', idsToDelete)
      
      const { error, count } = await supabase
        .from('presenze')
        .delete()
        .in('id', idsToDelete)

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      console.log('Delete successful. Rows affected:', count)
      
      // Aggiorna la lista
      await fetchPresenze()
      
      alert(`✅ Eliminate con successo ${idsToDelete.length} presenze per ${squadraNome} del ${dataFormatted}`)
    } catch (error) {
      console.error('Error deleting all presences:', error)
      alert(`❌ Errore durante l'eliminazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    } finally {
      setLoading(false)
    }
  }

  const saveReport = async () => {
    if (!profile?.id || !report.trim()) return

    try {
      const reportData = {
        allenatore_id: profile.id,
        squadra_id: selectedSquadra !== 'all' ? selectedSquadra : null,
        data: selectedDate,
        tipo_attivita: ATTENDANCE_TYPES[selectedType],
        report: report.trim(),
        organization_id: DEFAULT_ORGANIZATION_ID
      }

      const { data: existing } = await supabase
        .from('report_allenatori')
        .select('id')
        .eq('allenatore_id', profile.id)
        .eq('data', selectedDate)
        .eq('tipo_attivita', selectedType)
        .single()

      if (existing) {
        await supabase
          .from('report_allenatori')
          .update({ report: report.trim(), updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('report_allenatori')
          .insert(reportData)
      }

      alert('Report salvato con successo!')
    } catch (error) {
      console.error('Error saving report:', error)
      alert('Errore nel salvataggio del report')
    }
  }

  const presentiCount = presenze.filter(p => p.presente).length
  const percentualePresenza = presenze.length > 0 ? Math.round((presentiCount / presenze.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento presenze...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Presenze</h1>
          <p className="mt-2 text-gray-600">
            Registra e monitora le presenze agli allenamenti e alle partite
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('presenze')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'presenze'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="inline-block mr-2 h-4 w-4" />
            Presenze
          </button>
          <button
            onClick={() => setActiveTab('statistiche')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'statistiche'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="inline-block mr-2 h-4 w-4" />
            Statistiche
          </button>
          {hasAnyRole(['admin', 'dirigente', 'allenatore']) && (
            <button
              onClick={() => setActiveTab('report')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'report'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="inline-block mr-2 h-4 w-4" />
              Report
            </button>
          )}
        </nav>
      </div>

      {/* Filters */}
      {activeTab !== 'report' && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Attività
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as TipoAttivita)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALLENAMENTO">Allenamento</option>
                  <option value="PARTITA">Partita</option>
                  <option value="TORNEO">Torneo</option>
                  <option value="EVENTO">Evento</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Squadra
                </label>
                <select
                  value={selectedSquadra}
                  onChange={(e) => setSelectedSquadra(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tutte le squadre</option>
                  {squadre.map((squadra) => (
                    <option key={squadra.id} value={squadra.id}>
                      {squadra.nome} - {squadra.categoria}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presences List */}
      {activeTab === 'presenze' && (
        <>
          {/* Messaggio informativo se presenze già registrate */}
          {selectedSquadra !== 'all' && presenze.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center text-blue-800">
                  <UserCheck className="h-5 w-5 mr-2" />
                  <span className="font-medium">
                    Presenze già registrate per {ATTENDANCE_TYPES[selectedType].toLowerCase()} del {new Date(selectedDate).toLocaleDateString('it-IT')}.
                    Usa i pulsanti nelle singole presenze per modifiche.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {selectedSquadra !== 'all' && presenze.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Inserimento Rapido Presenze</CardTitle>
                <CardDescription>
                  Seleziona gli atleti presenti. Chi non viene selezionato sarà automaticamente segnato come assente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tesserati.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-500">Caricamento tesserati...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      {tesserati.map((tesserato) => (
                    <label
                      key={tesserato.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTesserati.has(tesserato.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedTesserati)
                          if (e.target.checked) {
                            newSet.add(tesserato.id)
                          } else {
                            newSet.delete(tesserato.id)
                          }
                          setSelectedTesserati(newSet)
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="font-medium">
                        {tesserato.cognome} {tesserato.nome}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex space-x-3">
                  <Button
                    onClick={() => setSelectedTesserati(new Set(tesserati.map(t => t.id)))}
                    variant="outline"
                    size="sm"
                  >
                    Seleziona Tutti
                  </Button>
                  <Button
                    onClick={() => setSelectedTesserati(new Set())}
                    variant="outline"
                    size="sm"
                  >
                    Deseleziona Tutti
                  </Button>
                  <div className="flex-1" />
                  <Button
                    onClick={() => handleBulkPresence()}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={tesserati.length === 0}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Registra Presenze
                  </Button>
                </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Lista Presenze - {new Date(selectedDate).toLocaleDateString('it-IT')}</CardTitle>
                  <CardDescription>
                    Attività: {ATTENDANCE_TYPES[selectedType]}
                    {selectedSquadra !== 'all' && (
                      <span className="ml-2">
                        • Squadra: {squadre.find(s => s.id === selectedSquadra)?.nome}
                      </span>
                    )}
                  </CardDescription>
                </div>
                
                {/* Pulsante Elimina Tutte le Presenze */}
                {hasAnyRole(['admin', 'dirigente']) && presenze.length > 0 && selectedSquadra !== 'all' && (
                  <Button
                    onClick={handleDeleteAllPresences}
                    variant="destructive"
                    size="sm"
                    className="ml-4"
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina Tutte ({presenze.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {presenze.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Nessuna presenza registrata per questa data
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {presenze.map((presenza) => (
                    <div
                      key={presenza.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${
                          presenza.presente ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <h4 className="font-medium">
                            {presenza.tesserati?.cognome} {presenza.tesserati?.nome}
                          </h4>
                          <p className="text-sm text-gray-500 capitalize">
                            {presenza.tipo}
                            {presenza.note && ` - ${presenza.note}`}
                          </p>
                        </div>
                      </div>
                      
                      {hasAnyRole(['admin', 'dirigente', 'allenatore']) && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant={presenza.presente ? "default" : "outline"}
                            onClick={() => togglePresenza(presenza.id, presenza.presente)}
                            className={presenza.presente ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={!presenza.presente ? "default" : "outline"}
                            onClick={() => togglePresenza(presenza.id, presenza.presente)}
                            className={!presenza.presente ? "bg-red-600 hover:bg-red-700" : ""}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics for Presenze Tab */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Presenti Oggi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {presentiCount}
                </div>
                <p className="text-sm text-gray-600">su {presenze.length} tesserati</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Percentuale Presenza</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {percentualePresenza}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentualePresenza}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Assenti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {presenze.length - presentiCount}
                </div>
                <p className="text-sm text-gray-600">tesserati assenti</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistiche' && (
        <StatistichePresenze 
          squadraId={selectedSquadra}
          periodo={statistichePeriodo}
          onPeriodoChange={setStatistichePeriodo}
        />
      )}

      {/* Report Tab */}
      {activeTab === 'report' && hasAnyRole(['admin', 'dirigente', 'allenatore']) && (
        <Card>
          <CardHeader>
            <CardTitle>Report Allenamento</CardTitle>
            <CardDescription>
              Scrivi un report per il responsabile su come è andata la sessione di oggi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo Attività
                  </label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as TipoAttivita)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALLENAMENTO">Allenamento</option>
                    <option value="PARTITA">Partita</option>
                    <option value="TORNEO">Torneo</option>
                    <option value="EVENTO">Evento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Squadra
                  </label>
                  <select
                    value={selectedSquadra}
                    onChange={(e) => setSelectedSquadra(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Seleziona una squadra</option>
                    {squadre.map((squadra) => (
                      <option key={squadra.id} value={squadra.id}>
                        {squadra.nome} - {squadra.categoria}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report
                </label>
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={8}
                  placeholder="Descrivi come è andata la sessione, eventuali problemi, progressi notati, suggerimenti..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={saveReport}
                  disabled={!report.trim() || selectedSquadra === 'all'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Salva Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Componente per le statistiche
function StatistichePresenze({ squadraId, periodo, onPeriodoChange }: { 
  squadraId: string, 
  periodo: StatistichePeriodo,
  onPeriodoChange: (p: StatistichePeriodo) => void 
}) {
  const [statistiche, setStatistiche] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchStatistiche()
  }, [squadraId, periodo])

  const fetchStatistiche = async () => {
    try {
      const { data, error } = await supabase
        .from('statistiche_presenze')
        .select('*')
        .order('percentuale', { ascending: false })

      if (error) throw error

      // Filtra per squadra e periodo
      let filtered = data || []
      if (squadraId !== 'all') {
        filtered = filtered.filter(s => s.squadra_id === squadraId)
      }

      // Filtra per periodo (ultima settimana o ultimo mese)
      const now = new Date()
      if (periodo === 'SETTIMANALE') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        filtered = filtered.filter(s => new Date(s.settimana) >= lastWeek)
      } else {
        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filtered = filtered.filter(s => new Date(s.mese) >= lastMonth)
      }

      setStatistiche(filtered)
    } catch (error) {
      console.error('Error fetching statistiche:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento statistiche...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Statistiche Presenze</CardTitle>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant={periodo === 'SETTIMANALE' ? 'default' : 'outline'}
                onClick={() => onPeriodoChange('SETTIMANALE')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Settimanale
              </Button>
              <Button
                size="sm"
                variant={periodo === 'MENSILE' ? 'default' : 'outline'}
                onClick={() => onPeriodoChange('MENSILE')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Mensile
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statistiche.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              Nessuna statistica disponibile per il periodo selezionato
            </p>
          ) : (
            <div className="space-y-4">
              {/* Statistiche per squadra */}
              <div>
                <h3 className="font-semibold mb-3">Riepilogo per Squadra</h3>
                <div className="space-y-2">
                  {Array.from(new Set(statistiche.map(s => s.squadra_nome)))
                    .filter(Boolean)
                    .map(squadraNome => {
                      const squadraStats = statistiche.filter(s => s.squadra_nome === squadraNome)
                      const avgPercentuale = Math.round(
                        squadraStats.reduce((acc, s) => acc + s.percentuale, 0) / squadraStats.length
                      )
                      return (
                        <div key={squadraNome} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{squadraNome}</span>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                              Media presenze: {avgPercentuale}%
                            </span>
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${avgPercentuale}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Top 10 giocatori */}
              <div>
                <h3 className="font-semibold mb-3">Top 10 Giocatori per Presenza</h3>
                <div className="space-y-2">
                  {statistiche
                    .slice(0, 10)
                    .map((stat, index) => (
                      <div key={`${stat.tesserato_id}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="font-medium">{stat.tesserato_nome}</span>
                          <span className="text-sm text-gray-500 ml-2">({stat.squadra_nome})</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-600">
                            {stat.presenze}/{stat.totale} presenze
                          </span>
                          <span className="font-semibold text-green-600">
                            {stat.percentuale}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}