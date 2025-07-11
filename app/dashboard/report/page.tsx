'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Save, Calendar, Users, Trophy, CheckCircle, XCircle, Plus, Lock } from 'lucide-react'
import { Database } from '@/types/database'

type Squadra = {
  id: string
  nome: string
  categoria: string
}

type TesseratoPresenze = {
  id: string
  nome: string
  cognome: string
  allenamenti_presenze: number
  allenamenti_totali: number
  percentuale: number
  dettaglio_presenze: { data: string; presente: boolean }[]
}

type PartitaMensile = {
  id: string
  data: string
  avversario: string
  risultato: string | null
  tipo_competizione: string
}

type ReportMensile = {
  id: string
  allenatore_id: string
  squadra_id: string | null
  mese: number
  anno: number
  report: string
  stato: 'bozza' | 'inviato'
  created_at: string
  updated_at: string
  tesserati_data?: TesseratoPresenze[]
  partite_data?: PartitaMensile[]
}

export default function ReportPage() {
  const { profile, hasAnyRole } = useAuth()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedMese, setSelectedMese] = useState(new Date().getMonth() + 1)
  const [selectedAnno, setSelectedAnno] = useState(new Date().getFullYear())
  const [selectedSquadra, setSelectedSquadra] = useState<string>('')
  const [squadreAllenatore, setSquadreAllenatore] = useState<Squadra[]>([])
  const [tesseratiData, setTesseratiData] = useState<TesseratoPresenze[]>([])
  const [partiteData, setPartiteData] = useState<PartitaMensile[]>([])
  const [reportTesto, setReportTesto] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const [statoReport, setStatoReport] = useState<'bozza' | 'inviato'>('bozza')
  const [loadingData, setLoadingData] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.id) {
      fetchSquadreAllenatore()
    }
  }, [profile?.id])

  useEffect(() => {
    if (selectedSquadra && selectedMese && selectedAnno) {
      loadReportData()
    }
  }, [selectedSquadra, selectedMese, selectedAnno])

  // Carica le squadre assegnate all'allenatore
  const fetchSquadreAllenatore = async () => {
    try {
      if (!profile?.id) return

      let query
      if (hasAnyRole(['admin', 'dirigente'])) {
        // Admin e dirigenti vedono tutte le squadre
        query = supabase.from('squadre').select('*').order('categoria')
      } else {
        // Allenatori vedono solo le squadre assegnate
        query = supabase
          .from('squadre')
          .select('*')
          .in('id', profile.squadra_id || [])
          .order('categoria')
      }

      const { data, error } = await query
      if (error) throw error
      
      setSquadreAllenatore(data || [])
      // Seleziona automaticamente la prima squadra se ce n'è una sola
      if (data && data.length === 1) {
        setSelectedSquadra(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching squadre allenatore:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carica tutti i dati per il report mensile
  const loadReportData = async () => {
    if (!selectedSquadra || !profile?.id) return
    
    setLoadingData(true)
    try {
      await Promise.all([
        loadTesseratiPresenze(),
        loadPartiteMensili(),
        loadReportEsistente()
      ])
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // Carica dati presenze tesserati
  const loadTesseratiPresenze = async () => {
    try {
      // Prima ottieni tutti i tesserati della squadra
      const { data: tesserati, error: tesseratiError } = await supabase
        .from('tesserati')
        .select('id, nome, cognome')
        .eq('squadra_id', selectedSquadra)
        .eq('stato', true)
        .order('cognome', { ascending: true })

      if (tesseratiError) throw tesseratiError

      // Poi ottieni le presenze del mese per tipo allenamento
      const startDate = new Date(selectedAnno, selectedMese - 1, 1)
      const endDate = new Date(selectedAnno, selectedMese, 0)

      const { data: presenze, error: presenzeError } = await supabase
        .from('presenze')
        .select('tesserato_id, data, presente')
        .eq('squadra_id', selectedSquadra)
        .eq('tipo', 'allenamento')
        .gte('data', startDate.toISOString().split('T')[0])
        .lte('data', endDate.toISOString().split('T')[0])

      if (presenzeError) throw presenzeError

      // Elabora i dati
      const tesseratiConPresenze: TesseratoPresenze[] = tesserati?.map(tesserato => {
        const presenzeTestserato = presenze?.filter(p => p.tesserato_id === tesserato.id) || []
        const presenti = presenzeTestserato.filter(p => p.presente).length
        const totali = presenzeTestserato.length
        
        return {
          id: tesserato.id,
          nome: tesserato.nome,
          cognome: tesserato.cognome,
          allenamenti_presenze: presenti,
          allenamenti_totali: totali,
          percentuale: totali > 0 ? Math.round((presenti / totali) * 100) : 0,
          dettaglio_presenze: presenzeTestserato.map(p => ({
            data: p.data,
            presente: p.presente
          })).sort((a, b) => a.data.localeCompare(b.data))
        }
      }) || []

      setTesseratiData(tesseratiConPresenze)
    } catch (error) {
      console.error('Error loading tesserati presenze:', error)
    }
  }

  // Carica partite del mese
  const loadPartiteMensili = async () => {
    try {
      const startDate = new Date(selectedAnno, selectedMese - 1, 1)
      const endDate = new Date(selectedAnno, selectedMese, 0)

      const { data: partite, error } = await supabase
        .from('partite')
        .select('id, data, avversario, risultato, tipo_competizione')
        .eq('squadra_id', selectedSquadra)
        .gte('data', startDate.toISOString().split('T')[0])
        .lte('data', endDate.toISOString().split('T')[0])
        .order('data')

      if (error) throw error

      setPartiteData(partite || [])
    } catch (error) {
      console.error('Error loading partite mensili:', error)
    }
  }

  // Carica report esistente se presente
  const loadReportEsistente = async () => {
    try {
      const { data: reportEsistente, error } = await supabase
        .from('report_mensili')
        .select('*')
        .eq('allenatore_id', profile?.id)
        .eq('squadra_id', selectedSquadra)
        .eq('mese', selectedMese)
        .eq('anno', selectedAnno)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      if (reportEsistente) {
        setReportId(reportEsistente.id)
        setReportTesto(reportEsistente.report)
        setStatoReport(reportEsistente.stato || 'bozza')
      } else {
        setReportId(null)
        setReportTesto('')
        setStatoReport('bozza')
      }
    } catch (error) {
      console.error('Error loading report esistente:', error)
    }
  }

  // Salva bozza del report
  const handleSaveBozza = async () => {
    if (!reportTesto.trim() || !selectedSquadra) {
      alert('Seleziona una squadra e inserisci del testo')
      return
    }

    try {
      const reportData = {
        allenatore_id: profile?.id,
        squadra_id: selectedSquadra,
        mese: selectedMese,
        anno: selectedAnno,
        report: reportTesto.trim(),
        stato: 'bozza' as const
      }

      if (reportId) {
        // Aggiorna report esistente
        const { error } = await supabase
          .from('report_mensili')
          .update(reportData)
          .eq('id', reportId)

        if (error) throw error
      } else {
        // Crea nuovo report
        const { data, error } = await supabase
          .from('report_mensili')
          .insert(reportData)
          .select('id')
          .single()

        if (error) throw error
        setReportId(data.id)
      }

      alert('Bozza salvata con successo!')
    } catch (error) {
      console.error('Error saving bozza:', error)
      alert('Errore nel salvataggio della bozza')
    }
  }

  // Invia report definitivo
  const handleInviaReport = async () => {
    if (!reportTesto.trim() || !selectedSquadra) {
      alert('Seleziona una squadra e inserisci del testo')
      return
    }

    if (statoReport === 'inviato') {
      alert('Il report è già stato inviato e non può essere modificato')
      return
    }

    const conferma = confirm('Sei sicuro di voler inviare il report? Una volta inviato non potrai più modificarlo.')
    if (!conferma) return

    try {
      const reportData = {
        allenatore_id: profile?.id,
        squadra_id: selectedSquadra,
        mese: selectedMese,
        anno: selectedAnno,
        report: reportTesto.trim(),
        stato: 'inviato' as const
      }

      if (reportId) {
        // Aggiorna report esistente
        const { error } = await supabase
          .from('report_mensili')
          .update(reportData)
          .eq('id', reportId)

        if (error) throw error
      } else {
        // Crea nuovo report
        const { data, error } = await supabase
          .from('report_mensili')
          .insert(reportData)
          .select('id')
          .single()

        if (error) throw error
        setReportId(data.id)
      }

      setStatoReport('inviato')
      alert('Report inviato con successo!')
    } catch (error) {
      console.error('Error sending report:', error)
      alert('Errore nell\'invio del report')
    }
  }

  const getMesiOptions = () => {
    const mesi = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ]
    return mesi.map((nome, index) => ({
      value: index + 1,
      label: nome
    }))
  }

  const formatData = (dataString: string) => {
    return new Date(dataString).toLocaleDateString('it-IT')
  }

  if (!hasAnyRole(['admin', 'dirigente', 'allenatore'])) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Accesso Negato</h2>
          <p className="mt-2 text-gray-600">Solo gli allenatori possono accedere ai report mensili.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Report Mensile</h1>
        <p className="mt-2 text-gray-600">
          Visualizza presenze, partite e compila il report per il mese selezionato
        </p>
      </div>

      {/* Selettori */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Squadra *
              </label>
              <select
                value={selectedSquadra}
                onChange={(e) => setSelectedSquadra(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={statoReport === 'inviato'}
              >
                <option value="">Seleziona squadra</option>
                {squadreAllenatore.map((squadra) => (
                  <option key={squadra.id} value={squadra.id}>
                    {squadra.nome} - {squadra.categoria}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mese *
              </label>
              <select
                value={selectedMese}
                onChange={(e) => setSelectedMese(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={statoReport === 'inviato'}
              >
                {getMesiOptions().map(mese => (
                  <option key={mese.value} value={mese.value}>
                    {mese.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anno *
              </label>
              <select
                value={selectedAnno}
                onChange={(e) => setSelectedAnno(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={statoReport === 'inviato'}
              >
                {[2024, 2025, 2026].map(anno => (
                  <option key={anno} value={anno}>
                    {anno}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stato Report */}
      {reportId && (
        <div className={`p-4 rounded-lg border-l-4 ${
          statoReport === 'inviato' 
            ? 'bg-green-50 border-green-400 text-green-700'
            : 'bg-yellow-50 border-yellow-400 text-yellow-700'
        }`}>
          <div className="flex items-center">
            {statoReport === 'inviato' ? (
              <Lock className="h-5 w-5 mr-2" />
            ) : (
              <FileText className="h-5 w-5 mr-2" />
            )}
            <p className="font-medium">
              {statoReport === 'inviato' 
                ? 'Report inviato - Non più modificabile'
                : 'Bozza del report - Puoi ancora modificarlo'
              }
            </p>
          </div>
        </div>
      )}

      {selectedSquadra && !loadingData && (
        <>
          {/* Tabella Presenze Tesserati */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Presenze Allenamenti - {getMesiOptions()[selectedMese - 1]?.label} {selectedAnno}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tesseratiData.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nessun tesserato trovato per questa squadra
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tesserato
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Presenze
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Totale
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Percentuale
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tesseratiData.map((tesserato) => (
                        <tr key={tesserato.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {tesserato.cognome} {tesserato.nome}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              {tesserato.allenamenti_presenze}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            {tesserato.allenamenti_totali}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              tesserato.percentuale >= 80 
                                ? 'bg-green-100 text-green-800'
                                : tesserato.percentuale >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {tesserato.percentuale}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Partite del Mese */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Partite - {getMesiOptions()[selectedMese - 1]?.label} {selectedAnno}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partiteData.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nessuna partita programmata per questo mese
                </p>
              ) : (
                <div className="space-y-3">
                  {partiteData.map((partita) => (
                    <div key={partita.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          vs {partita.avversario}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatData(partita.data)} • {partita.tipo_competizione}
                        </div>
                      </div>
                      <div className="text-right">
                        {partita.risultato ? (
                          <span className="font-medium text-blue-600">
                            {partita.risultato}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            Da giocare
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campo Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Mensile
              </CardTitle>
              <CardDescription>
                Descrivi le attività del mese, progressi, criticità e obiettivi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={reportTesto}
                onChange={(e) => setReportTesto(e.target.value)}
                rows={12}
                placeholder="Scrivi qui il report mensile: attività svolte, progressi dei tesserati, criticità riscontrate, obiettivi raggiunti e prossimi step..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={statoReport === 'inviato'}
              />
              
              {statoReport !== 'inviato' && (
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleSaveBozza}
                    disabled={!reportTesto.trim()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salva Bozza
                  </Button>
                  <Button
                    onClick={handleInviaReport}
                    disabled={!reportTesto.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Invia Report
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {loadingData && selectedSquadra && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Caricamento dati report...</p>
          </div>
        </div>
      )}
    </div>
  )
}