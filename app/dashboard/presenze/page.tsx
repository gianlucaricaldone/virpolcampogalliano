'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Check, X, Filter, Search, Users, BarChart3, FileText, Clock, UserCheck } from 'lucide-react'
import { Database } from '@/types/database'

type Presenza = Database['public']['Tables']['presenze']['Row'] & {
  tesserati?: { nome: string; cognome: string; squadra_id: string }
}

type TipoAttivita = 'allenamento' | 'partita' | 'torneo' | 'evento'

type StatistichePeriodo = 'settimanale' | 'mensile'

export default function PresenzePage() {
  const { profile, hasAnyRole } = useAuth()
  const { stagioneCorrente } = useSeason()
  const [presenze, setPresenze] = useState<Presenza[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedType, setSelectedType] = useState<TipoAttivita>('allenamento')
  const [activeTab, setActiveTab] = useState<'presenze' | 'statistiche' | 'report'>('presenze')
  const [squadre, setSquadre] = useState<any[]>([])
  const [selectedSquadra, setSelectedSquadra] = useState<string>('all')
  const [tesserati, setTesserati] = useState<any[]>([])
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedTesserati, setSelectedTesserati] = useState<Set<string>>(new Set())
  const [report, setReport] = useState('')
  const [statistichePeriodo, setStatistichePeriodo] = useState<StatistichePeriodo>('settimanale')
  const supabase = createClient()

  useEffect(() => {
    if (stagioneCorrente?.id) {
      fetchSquadre()
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
    if (!stagioneCorrente?.id) return
    
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
      setSquadre(data || [])
    } catch (error) {
      console.error('Error fetching squadre:', error)
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
        .order('tesserati(cognome)')

      if (error) throw error
      
      // Estrai i tesserati e filtra quelli attivi
      const tesseratiAttivi = (data || [])
        .map(item => item.tesserati)
        .filter(t => t !== null)
      
      setTesserati(tesseratiAttivi)
    } catch (error) {
      console.error('Error fetching tesserati:', error)
    }
  }

  const fetchPresenze = async () => {
    try {
      let query = supabase
        .from('presenze')
        .select(`
          *,
          tesserati:tesserato_id (nome, cognome, squadra_id)
        `)
        .eq('data', selectedDate)
        .order('created_at', { ascending: false })

      query = query.eq('tipo', selectedType)

      const { data, error } = await query

      if (error) throw error
      
      // Filtra per squadra se selezionata
      let filteredData = data || []
      if (selectedSquadra !== 'all') {
        filteredData = filteredData.filter(p => p.tesserati?.squadra_id === selectedSquadra)
      }
      
      setPresenze(filteredData)
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

  const handleBulkPresence = async (isPresent: boolean) => {
    if (selectedTesserati.size === 0) return

    try {
      const promises = Array.from(selectedTesserati).map(async (tesseratoId) => {
        // Controlla se esiste già una presenza per oggi
        const { data: existing } = await supabase
          .from('presenze')
          .select('id')
          .eq('tesserato_id', tesseratoId)
          .eq('data', selectedDate)
          .single()

        if (existing) {
          // Aggiorna presenza esistente
          return supabase
            .from('presenze')
            .update({ presente: isPresent, tipo: selectedType })
            .eq('id', existing.id)
        } else {
          // Crea nuova presenza
          return supabase
            .from('presenze')
            .insert({
              tesserato_id: tesseratoId,
              data: selectedDate,
              tipo: selectedType,
              presente: isPresent,
              squadra_id: selectedSquadra !== 'all' ? selectedSquadra : null
            })
        }
      })

      await Promise.all(promises)
      setSelectedTesserati(new Set())
      setBulkMode(false)
      fetchPresenze()
    } catch (error) {
      console.error('Error updating bulk presences:', error)
    }
  }

  const saveReport = async () => {
    if (!profile?.id || !report.trim()) return

    try {
      const reportData = {
        allenatore_id: profile.id,
        squadra_id: selectedSquadra !== 'all' ? selectedSquadra : null,
        data: selectedDate,
        tipo_attivita: selectedType,
        report: report.trim()
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
                  <option value="allenamento">Allenamento</option>
                  <option value="partita">Partita</option>
                  <option value="torneo">Torneo</option>
                  <option value="evento">Evento</option>
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
              {activeTab === 'presenze' && selectedSquadra !== 'all' && (
                <div className="flex items-end">
                  <Button
                    onClick={() => setBulkMode(!bulkMode)}
                    variant={bulkMode ? 'default' : 'outline'}
                    className="w-full"
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {bulkMode ? 'Annulla Selezione' : 'Inserimento Rapido'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics for Presenze Tab */}
      {activeTab === 'presenze' && (
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
      )}

      {/* Presences List */}
      {activeTab === 'presenze' && (
        <>
          {bulkMode && selectedSquadra !== 'all' && (
            <Card>
              <CardHeader>
                <CardTitle>Inserimento Rapido Presenze</CardTitle>
                <CardDescription>
                  Seleziona gli atleti e poi clicca su "Tutti Presenti" o "Tutti Assenti"
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                        {tesserato.nome} {tesserato.cognome}
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
                    onClick={() => handleBulkPresence(true)}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={selectedTesserati.size === 0}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Tutti Presenti ({selectedTesserati.size})
                  </Button>
                  <Button
                    onClick={() => handleBulkPresence(false)}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={selectedTesserati.size === 0}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Tutti Assenti ({selectedTesserati.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Lista Presenze - {new Date(selectedDate).toLocaleDateString('it-IT')}</CardTitle>
              <CardDescription>
                Attività: {selectedType}
              </CardDescription>
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
                            {presenza.tesserati?.nome} {presenza.tesserati?.cognome}
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
                    <option value="allenamento">Allenamento</option>
                    <option value="partita">Partita</option>
                    <option value="torneo">Torneo</option>
                    <option value="evento">Evento</option>
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
      if (periodo === 'settimanale') {
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
                variant={periodo === 'settimanale' ? 'default' : 'outline'}
                onClick={() => onPeriodoChange('settimanale')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Settimanale
              </Button>
              <Button
                size="sm"
                variant={periodo === 'mensile' ? 'default' : 'outline'}
                onClick={() => onPeriodoChange('mensile')}
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