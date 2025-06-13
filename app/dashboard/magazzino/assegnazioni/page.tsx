'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Package, Users, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface AssegnazioneDettaglio {
  id: string
  materiale_id: string
  squadra_id: string
  nome_articolo: string
  tipo_materiale: string
  materiale_categoria: string | null
  codice_tracking: string | null
  squadra_nome: string
  squadra_categoria: string
  quantita: number
  quantita_restituita: number
  quantita_ancora_assegnata: number
  data_assegnazione: string
  data_restituzione: string | null
  stato: 'attiva' | 'restituita' | 'parziale'
  note: string | null
  condizione_restituzione: string | null
  assegnato_da: string
  stagione_nome: string
}

interface RestituzioneForm {
  quantita_restituita: number
  condizione: string
  note: string
}

export default function AssegnazioniPage() {
  const { profile } = useAuth()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [assegnazioni, setAssegnazioni] = useState<AssegnazioneDettaglio[]>([])
  const [filtroStato, setFiltroStato] = useState<string>('attiva')
  const [filtroSquadra, setFiltroSquadra] = useState<string>('tutte')
  const [squadre, setSquadre] = useState<{id: string, nome: string}[]>([])
  const [showRestituzioneModal, setShowRestituzioneModal] = useState(false)
  const [assegnazioneSelezionata, setAssegnazioneSelezionata] = useState<AssegnazioneDettaglio | null>(null)
  const [restituzioneForm, setRestituzioneForm] = useState<RestituzioneForm>({
    quantita_restituita: 0,
    condizione: 'buone',
    note: ''
  })

  const canEdit = profile?.role && ['admin', 'dirigente', 'allenatore'].includes(profile.role)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch assegnazioni
      const { data: assegnazioniData, error: assegnazioniError } = await supabase
        .from('v_assegnazioni_dettaglio')
        .select('*')
        .order('data_assegnazione', { ascending: false })

      if (assegnazioniError) throw assegnazioniError
      setAssegnazioni(assegnazioniData || [])

      // Fetch squadre uniche
      const squadreUniche = Array.from(new Set(
        (assegnazioniData || []).map(a => JSON.stringify({id: a.squadra_id, nome: a.squadra_nome}))
      )).map(s => JSON.parse(s))
      setSquadre(squadreUniche)
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRestituzione = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assegnazioneSelezionata) return

    try {
      const { error } = await supabase.rpc('restituisci_materiale_squadra', {
        p_assegnazione_id: assegnazioneSelezionata.id,
        p_quantita_restituita: restituzioneForm.quantita_restituita,
        p_condizione: restituzioneForm.condizione,
        p_note: restituzioneForm.note || null
      })

      if (error) throw error

      setShowRestituzioneModal(false)
      setAssegnazioneSelezionata(null)
      setRestituzioneForm({
        quantita_restituita: 0,
        condizione: 'buone',
        note: ''
      })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Errore nella restituzione')
    }
  }

  const openRestituzioneModal = (assegnazione: AssegnazioneDettaglio) => {
    setAssegnazioneSelezionata(assegnazione)
    setRestituzioneForm({
      quantita_restituita: assegnazione.quantita_ancora_assegnata,
      condizione: 'buone',
      note: ''
    })
    setShowRestituzioneModal(true)
  }

  const assegnazioniFiltrate = assegnazioni.filter(assegnazione => {
    if (filtroStato !== 'tutte' && assegnazione.stato !== filtroStato) return false
    if (filtroSquadra !== 'tutte' && assegnazione.squadra_id !== filtroSquadra) return false
    return true
  })

  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case 'attiva':
        return <Badge className="bg-green-100 text-green-800">Attiva</Badge>
      case 'restituita':
        return <Badge className="bg-gray-100 text-gray-800">Restituita</Badge>
      case 'parziale':
        return <Badge className="bg-yellow-100 text-yellow-800">Parziale</Badge>
      default:
        return <Badge>{stato}</Badge>
    }
  }

  const totaleAssegnazioni = assegnazioni.filter(a => a.stato === 'attiva').length
  const materialeTotaleAssegnato = assegnazioni
    .filter(a => a.stato === 'attiva')
    .reduce((acc, a) => acc + a.quantita_ancora_assegnata, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Caricamento assegnazioni...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assegnazioni Materiale</h1>
          <p className="mt-2 text-gray-600">
            Gestisci le assegnazioni e restituzioni del materiale
          </p>
        </div>
        <Link href="/dashboard/magazzino">
          <Button variant="outline">
            <Package className="mr-2 h-4 w-4" />
            Torna al Magazzino
          </Button>
        </Link>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Assegnazioni Attive</p>
                <p className="text-2xl font-bold">{totaleAssegnazioni}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pezzi Assegnati</p>
                <p className="text-2xl font-bold text-orange-600">{materialeTotaleAssegnato}</p>
              </div>
              <Package className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Squadre con Materiale</p>
                <p className="text-2xl font-bold text-purple-600">{squadre.length}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-2">Stato</label>
              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="tutte">Tutti gli stati</option>
                <option value="attiva">Attive</option>
                <option value="restituita">Restituite</option>
                <option value="parziale">Parziali</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Squadra</label>
              <select
                value={filtroSquadra}
                onChange={(e) => setFiltroSquadra(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="tutte">Tutte le squadre</option>
                {squadre.map(squadra => (
                  <option key={squadra.id} value={squadra.id}>{squadra.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista assegnazioni */}
      <div className="space-y-4">
        {assegnazioniFiltrate.map((assegnazione) => (
          <Card key={assegnazione.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{assegnazione.nome_articolo}</h3>
                  <p className="text-gray-500">{assegnazione.tipo_materiale}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Squadra: <span className="font-medium">{assegnazione.squadra_nome}</span>
                  </p>
                </div>
                {getStatoBadge(assegnazione.stato)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Quantità assegnata</p>
                  <p className="font-semibold">{assegnazione.quantita} pz</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ancora da restituire</p>
                  <p className="font-semibold text-orange-600">{assegnazione.quantita_ancora_assegnata} pz</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Data assegnazione</p>
                  <p className="font-semibold">
                    {new Date(assegnazione.data_assegnazione).toLocaleDateString('it-IT')}
                  </p>
                </div>
                {assegnazione.data_restituzione && (
                  <div>
                    <p className="text-sm text-gray-500">Data restituzione</p>
                    <p className="font-semibold">
                      {new Date(assegnazione.data_restituzione).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                )}
              </div>

              {assegnazione.note && (
                <div className="mb-3">
                  <p className="text-sm text-gray-500">Note</p>
                  <p className="text-sm">{assegnazione.note}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                {assegnazione.stato === 'attiva' && canEdit && (
                  <Button 
                    onClick={() => openRestituzioneModal(assegnazione)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Registra Restituzione
                  </Button>
                )}
                <Link href={`/dashboard/magazzino/${assegnazione.materiale_id}`}>
                  <Button variant="outline" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    Dettagli Articolo
                  </Button>
                </Link>
                <Link href={`/dashboard/magazzino/squadra/${assegnazione.squadra_id}`}>
                  <Button variant="outline" size="sm">
                    <Users className="mr-2 h-4 w-4" />
                    Materiale Squadra
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {assegnazioniFiltrate.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessuna assegnazione trovata</p>
          </CardContent>
        </Card>
      )}

      {/* Modal restituzione */}
      <Dialog open={showRestituzioneModal} onOpenChange={setShowRestituzioneModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Restituzione</DialogTitle>
          </DialogHeader>
          
          {assegnazioneSelezionata && (
            <form onSubmit={handleRestituzione} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Articolo: <span className="font-medium">{assegnazioneSelezionata.nome_articolo}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Squadra: <span className="font-medium">{assegnazioneSelezionata.squadra_nome}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Quantità da restituire *
                </label>
                <input
                  type="number"
                  value={restituzioneForm.quantita_restituita}
                  onChange={(e) => setRestituzioneForm({
                    ...restituzioneForm, 
                    quantita_restituita: parseInt(e.target.value) || 0
                  })}
                  min="1"
                  max={assegnazioneSelezionata.quantita_ancora_assegnata}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Massimo restituibile: {assegnazioneSelezionata.quantita_ancora_assegnata}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Condizioni del materiale *
                </label>
                <select
                  value={restituzioneForm.condizione}
                  onChange={(e) => setRestituzioneForm({...restituzioneForm, condizione: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="buone">Buone condizioni</option>
                  <option value="usurato">Usurato</option>
                  <option value="danneggiato">Danneggiato</option>
                  <option value="da_riparare">Da riparare</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Note (opzionale)
                </label>
                <textarea
                  value={restituzioneForm.note}
                  onChange={(e) => setRestituzioneForm({...restituzioneForm, note: e.target.value})}
                  rows={3}
                  placeholder="es. 1 pallone bucato, 2 pettorine strappate..."
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  Conferma Restituzione
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowRestituzioneModal(false)}
                >
                  Annulla
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}