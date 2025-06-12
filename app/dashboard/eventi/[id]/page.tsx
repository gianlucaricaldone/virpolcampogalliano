'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  ArrowLeft, 
  CalendarDays, 
  MapPin, 
  Euro, 
  Users, 
  Plus, 
  Check, 
  X, 
  Edit,
  Trash,
  Phone,
  Mail
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

interface Evento {
  id: string
  nome: string
  descrizione: string | null
  data_evento: string
  luogo: string | null
  costo_persona: number | null
  max_partecipanti: number | null
  tipologia: string
}

interface Prenotazione {
  id: string
  nome_partecipante: string
  email: string | null
  telefono: string | null
  note: string | null
  confermato: boolean
  presente: boolean
  no_maiale: boolean
  vegetariano_vegano: boolean
  celiaco: boolean
}

export default function EventoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [evento, setEvento] = useState<Evento | null>(null)
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPrenotazione, setNewPrenotazione] = useState({
    nome_partecipante: '',
    telefono: '',
    note: '',
    no_maiale: false,
    vegetariano_vegano: false,
    celiaco: false
  })

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dirigente'

  useEffect(() => {
    if (params.id) {
      fetchEvento()
      fetchPrenotazioni()
    }
  }, [params.id])

  const fetchEvento = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('eventi')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setEvento(data)
    } catch (error) {
      console.error('Errore nel caricamento dell\'evento:', error)
    }
  }

  const fetchPrenotazioni = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('prenotazioni_eventi')
        .select('*')
        .eq('evento_id', params.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPrenotazioni(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle prenotazioni:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPrenotazione = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('prenotazioni_eventi')
        .insert([{
          evento_id: params.id,
          ...newPrenotazione
        }])

      if (error) throw error

      setNewPrenotazione({
        nome_partecipante: '',
        telefono: '',
        note: '',
        no_maiale: false,
        vegetariano_vegano: false,
        celiaco: false
      })
      setShowAddForm(false)
      fetchPrenotazioni()
    } catch (error) {
      console.error('Errore nell\'aggiunta della prenotazione:', error)
      alert('Errore nell\'aggiunta della prenotazione')
    }
  }


  const togglePresente = async (prenotazione: Prenotazione) => {
    if (!isAdmin) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('prenotazioni_eventi')
        .update({ presente: !prenotazione.presente })
        .eq('id', prenotazione.id)

      if (error) throw error
      fetchPrenotazioni()
    } catch (error) {
      console.error('Errore nell\'aggiornamento:', error)
    }
  }

  const deletePrenotazione = async (id: string) => {
    if (!isAdmin || !confirm('Sei sicuro di voler eliminare questa prenotazione? (Azione da usare solo per correggere errori)')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('prenotazioni_eventi')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchPrenotazioni()
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading || !evento) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const presenze = prenotazioni.filter(p => p.presente).length
  const totaleIncassato = evento.costo_persona ? evento.costo_persona * presenze : 0

  // Calcoli per preferenze alimentari (solo per eventi cena)
  const noMaiale = prenotazioni.filter(p => p.no_maiale).length
  const vegetarianoVegano = prenotazioni.filter(p => p.vegetariano_vegano).length
  const celiaco = prenotazioni.filter(p => p.celiaco).length

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/eventi">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{evento.nome}</h1>
      </div>

      {/* Indicatori per eventi cena */}
      {evento.tipologia === 'cena' && prenotazioni.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-orange-800">Preferenze Alimentari</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
              <span className="text-sm font-medium">No Maiale</span>
              <span className="text-lg font-bold text-orange-600">{noMaiale}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
              <span className="text-sm font-medium">Vegetariano/Vegano</span>
              <span className="text-lg font-bold text-green-600">{vegetarianoVegano}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
              <span className="text-sm font-medium">Celiaco</span>
              <span className="text-lg font-bold text-blue-600">{celiaco}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dettagli Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evento.descrizione && (
                <p className="text-gray-600">{evento.descrizione}</p>
              )}
              
              <div className="space-y-2">
                <div className="flex items-center text-gray-600">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {formatDate(evento.data_evento)}
                </div>
                {evento.luogo && (
                  <div className="flex items-center text-gray-600">
                    <MapPin className="mr-2 h-4 w-4" />
                    {evento.luogo}
                  </div>
                )}
                {evento.costo_persona && (
                  <div className="flex items-center text-gray-600">
                    <Euro className="mr-2 h-4 w-4" />
                    €{evento.costo_persona.toFixed(2)} a persona
                  </div>
                )}
                {evento.max_partecipanti && (
                  <div className="flex items-center text-gray-600">
                    <Users className="mr-2 h-4 w-4" />
                    Max {evento.max_partecipanti} partecipanti
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prenotazioni ({prenotazioni.length})</CardTitle>
              <Button
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi
              </Button>
            </CardHeader>
            <CardContent>
              {showAddForm && (
                <form onSubmit={handleAddPrenotazione} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nome *"
                      value={newPrenotazione.nome_partecipante}
                      onChange={(e) => setNewPrenotazione({...newPrenotazione, nome_partecipante: e.target.value})}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      placeholder="Telefono"
                      value={newPrenotazione.telefono}
                      onChange={(e) => setNewPrenotazione({...newPrenotazione, telefono: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Note"
                      value={newPrenotazione.note}
                      onChange={(e) => setNewPrenotazione({...newPrenotazione, note: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2"
                    />
                  </div>
                  {evento?.tipologia === 'cena' && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium mb-2">Preferenze alimentari:</p>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newPrenotazione.no_maiale}
                            onChange={(e) => setNewPrenotazione({...newPrenotazione, no_maiale: e.target.checked})}
                            className="mr-2"
                          />
                          <span className="text-sm">No maiale</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newPrenotazione.vegetariano_vegano}
                            onChange={(e) => setNewPrenotazione({...newPrenotazione, vegetariano_vegano: e.target.checked})}
                            className="mr-2"
                          />
                          <span className="text-sm">Vegetariano/Vegano</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newPrenotazione.celiaco}
                            onChange={(e) => setNewPrenotazione({...newPrenotazione, celiaco: e.target.checked})}
                            className="mr-2"
                          />
                          <span className="text-sm">Celiaco</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Aggiungi</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                      Annulla
                    </Button>
                  </div>
                </form>
              )}

              {prenotazioni.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nessuna prenotazione registrata
                </p>
              ) : (
                <div className="space-y-2">
                  {prenotazioni.map((prenotazione) => (
                    <div
                      key={prenotazione.id}
                      className={`p-3 rounded-lg border ${
                        prenotazione.presente 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{prenotazione.nome_partecipante}</div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {prenotazione.email && (
                              <div className="flex items-center">
                                <Mail className="mr-1 h-3 w-3" />
                                {prenotazione.email}
                              </div>
                            )}
                            {prenotazione.telefono && (
                              <div className="flex items-center">
                                <Phone className="mr-1 h-3 w-3" />
                                {prenotazione.telefono}
                              </div>
                            )}
                            {prenotazione.note && (
                              <div className="text-xs italic">{prenotazione.note}</div>
                            )}
                            {evento.tipologia === 'cena' && (prenotazione.no_maiale || prenotazione.vegetariano_vegano || prenotazione.celiaco) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {prenotazione.no_maiale && (
                                  <span className="px-1 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">No maiale</span>
                                )}
                                {prenotazione.vegetariano_vegano && (
                                  <span className="px-1 py-0.5 text-xs bg-green-100 text-green-800 rounded">Vegetariano/Vegano</span>
                                )}
                                {prenotazione.celiaco && (
                                  <span className="px-1 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Celiaco</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {prenotazione.presente && (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-600 text-white">Presente</span>
                          )}
                          {!prenotazione.presente && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-400 text-white">Assente</span>
                          )}
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={prenotazione.presente ? "default" : "outline"}
                                className={prenotazione.presente ? "bg-green-600 hover:bg-green-700" : ""}
                                onClick={() => togglePresente(prenotazione)}
                                title={prenotazione.presente ? "Segna come assente" : "Segna come presente"}
                              >
                                {prenotazione.presente ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deletePrenotazione(prenotazione.id)}
                                title="Elimina prenotazione (solo per errori)"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Riepilogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Prenotazioni:</span>
                <span className="font-semibold">{prenotazioni.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Presenti:</span>
                <span className="font-semibold text-green-600">{presenze}</span>
              </div>
              {evento.max_partecipanti && (
                <div className="flex justify-between">
                  <span>Posti disponibili:</span>
                  <span className="font-semibold">
                    {Math.max(0, evento.max_partecipanti - prenotazioni.length)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {evento.costo_persona && (
            <Card>
              <CardHeader>
                <CardTitle>Riepilogo Economico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Costo a persona:</span>
                  <span>€{evento.costo_persona.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Presenti:</span>
                  <span>{presenze}</span>
                </div>
                <hr />
                <div className="flex justify-between text-lg font-bold">
                  <span>Totale:</span>
                  <span className="text-green-600">€{totaleIncassato.toFixed(2)}</span>
                </div>
                {prenotazioni.length > presenze && (
                  <div className="text-sm text-gray-600">
                    Potenziale con tutti i prenotati: €{(evento.costo_persona * prenotazioni.length).toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}