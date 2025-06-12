'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSeason } from '@/contexts/SeasonContext'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Settings, Calendar, Edit, Trash2, Archive, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react'
import { Database } from '@/types/database'

type StagioneSportiva = Database['public']['Tables']['stagioni_sportive']['Row']
type ParametroSistema = Database['public']['Tables']['parametri_sistema']['Row']

export default function ParametriPage() {
  const { profile } = useAuth()
  const { stagioni, stagioneCorrente, refreshStagioni, setStagioneCorrente: setSeasonCurrent, loading: seasonLoading } = useSeason()
  const [parametri, setParametri] = useState<ParametroSistema[]>([])
  const [loading, setLoading] = useState(true)
  const [showStagioneForm, setShowStagioneForm] = useState(false)
  const [selectedStagione, setSelectedStagione] = useState<StagioneSportiva | null>(null)
  
  const [nuovaStagione, setNuovaStagione] = useState({
    nome: '',
    data_inizio: '',
    data_fine: '',
    descrizione: ''
  })

  const supabase = createClient()

  // Redirect se non admin (solo dopo che il profilo è caricato)
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      window.location.href = '/dashboard'
    }
  }, [profile])

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchParametri()
    }
  }, [profile])

  const fetchParametri = async () => {
    try {
      // Carica solo parametri
      const { data: parametriData, error: parametriError } = await supabase
        .from('parametri_sistema')
        .select('*')
        .order('chiave', { ascending: true })

      if (parametriError) throw parametriError

      setParametri(parametriData || [])

    } catch (error) {
      console.error('Error fetching parametri:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStagione = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nuovaStagione.nome || !nuovaStagione.data_inizio || !nuovaStagione.data_fine) {
      alert('Compila tutti i campi obbligatori')
      return
    }

    try {
      const { error } = await supabase
        .from('stagioni_sportive')
        .insert({
          nome: nuovaStagione.nome,
          data_inizio: nuovaStagione.data_inizio,
          data_fine: nuovaStagione.data_fine,
          descrizione: nuovaStagione.descrizione || null,
          attiva: false
        })

      if (error) throw error

      setNuovaStagione({ nome: '', data_inizio: '', data_fine: '', descrizione: '' })
      setShowStagioneForm(false)
      refreshStagioni()
    } catch (error) {
      console.error('Error creating stagione:', error)
      alert('Errore durante la creazione della stagione')
    }
  }

  const handleSetStagioneCorrente = async (stagioneId: string) => {
    try {
      await setSeasonCurrent(stagioneId)
    } catch (error) {
      console.error('Error setting stagione corrente:', error)
      alert('Errore durante l\'impostazione della stagione corrente')
    }
  }

  const archiveStagione = async (stagioneId: string) => {
    if (!confirm('Sei sicuro di voler archiviare questa stagione? I dati rimarranno consultabili ma non modificabili.')) {
      return
    }

    try {
      await supabase
        .from('stagioni_sportive')
        .update({ 
          archiviata: true,
          attiva: false 
        })
        .eq('id', stagioneId)

      // Se era la stagione corrente, azzera il parametro
      if (stagioneCorrente?.id === stagioneId) {
        await supabase
          .from('parametri_sistema')
          .update({ valore: null })
          .eq('chiave', 'stagione_corrente_id')
      }

      refreshStagioni()
    } catch (error) {
      console.error('Error archiving stagione:', error)
      alert('Errore durante l\'archiviazione della stagione')
    }
  }

  const ripristinaStagione = async (stagioneId: string) => {
    try {
      await supabase
        .from('stagioni_sportive')
        .update({ archiviata: false })
        .eq('id', stagioneId)

      refreshStagioni()
    } catch (error) {
      console.error('Error restoring stagione:', error)
      alert('Errore durante il ripristino della stagione')
    }
  }

  const updateParametro = async (id: string, nuovoValore: string) => {
    try {
      await supabase
        .from('parametri_sistema')
        .update({ valore: nuovoValore })
        .eq('id', id)

      fetchParametri()
    } catch (error) {
      console.error('Error updating parametro:', error)
      alert('Errore durante l\'aggiornamento del parametro')
    }
  }

  // Non mostrare nulla se stiamo ancora caricando o se non è admin
  if (!profile || profile.role !== 'admin') {
    return loading || seasonLoading ? (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    ) : null
  }

  if (loading || seasonLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento parametri...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Parametri Sistema</h1>
        <p className="mt-2 text-gray-600">
          Gestisci le stagioni sportive e i parametri globali del sistema
        </p>
      </div>

      {/* Stagione Corrente Status */}
      <div className={`p-3 rounded-lg border ${stagioneCorrente ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
        <div className="flex items-center">
          {stagioneCorrente ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-900">
                Stagione attiva: <strong>{stagioneCorrente.nome}</strong>
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-900">
                Nessuna stagione corrente impostata
              </span>
            </>
          )}
        </div>
      </div>

      {/* Gestione Stagioni */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Stagioni Sportive
            </CardTitle>
            <CardDescription>
              Gestisci le stagioni sportive e imposta quella corrente
            </CardDescription>
          </div>
          <Button onClick={() => setShowStagioneForm(!showStagioneForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuova Stagione
          </Button>
        </CardHeader>
        <CardContent>
          {/* Form Nuova Stagione */}
          {showStagioneForm && (
            <form onSubmit={handleCreateStagione} className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Stagione *
                  </label>
                  <input
                    type="text"
                    value={nuovaStagione.nome}
                    onChange={(e) => setNuovaStagione(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="es. 2025/2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <input
                    type="text"
                    value={nuovaStagione.descrizione}
                    onChange={(e) => setNuovaStagione(prev => ({ ...prev, descrizione: e.target.value }))}
                    placeholder="es. Stagione sportiva 2025/2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inizio *
                  </label>
                  <input
                    type="date"
                    value={nuovaStagione.data_inizio}
                    onChange={(e) => setNuovaStagione(prev => ({ ...prev, data_inizio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine *
                  </label>
                  <input
                    type="date"
                    value={nuovaStagione.data_fine}
                    onChange={(e) => setNuovaStagione(prev => ({ ...prev, data_fine: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="submit">Crea Stagione</Button>
                <Button type="button" variant="outline" onClick={() => setShowStagioneForm(false)}>
                  Annulla
                </Button>
              </div>
            </form>
          )}

          {/* Lista Stagioni */}
          <div className="space-y-4">
            {stagioni.map((stagione) => (
              <div key={stagione.id} className={`p-4 border rounded-lg ${stagione.attiva ? 'border-green-500 bg-green-50' : stagione.archiviata ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">{stagione.nome}</h3>
                      {stagione.attiva && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Corrente
                        </span>
                      )}
                      {stagione.archiviata && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                          Archiviata
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {new Date(stagione.data_inizio).toLocaleDateString('it-IT')} - {new Date(stagione.data_fine).toLocaleDateString('it-IT')}
                    </p>
                    {stagione.descrizione && (
                      <p className="text-sm text-gray-500">{stagione.descrizione}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!stagione.archiviata && !stagione.attiva && (
                      <Button 
                        size="sm" 
                        onClick={() => handleSetStagioneCorrente(stagione.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Imposta Corrente
                      </Button>
                    )}
                    {!stagione.archiviata ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => archiveStagione(stagione.id)}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Archivia
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => ripristinaStagione(stagione.id)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Ripristina
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Parametri Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Parametri Sistema
          </CardTitle>
          <CardDescription>
            Configura i parametri globali della società
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {parametri.filter(p => p.chiave !== 'stagione_corrente_id').map((parametro) => (
              <div key={parametro.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{parametro.descrizione || parametro.chiave}</h4>
                  <p className="text-sm text-gray-500">Chiave: {parametro.chiave}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type={parametro.tipo === 'number' ? 'number' : parametro.tipo === 'date' ? 'date' : 'text'}
                    value={parametro.valore || ''}
                    onChange={(e) => updateParametro(parametro.id, e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Valore..."
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}