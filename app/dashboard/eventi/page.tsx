'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, MapPin, Users, Euro, Plus, ChevronRight, Trash2 } from 'lucide-react'
import Link from 'next/link'
import EventoForm from '@/components/forms/EventoForm'
import { useAuth } from '@/hooks/useAuth'

interface Evento {
  id: string
  nome: string
  descrizione: string | null
  data_evento: string
  luogo: string | null
  costo_persona: number | null
  max_partecipanti: number | null
  prenotazioni_count: number
  presenze_count: number
}

export default function EventiPage() {
  const [eventi, setEventi] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [showEventoForm, setShowEventoForm] = useState(false)
  const { profile } = useAuth()
  const router = useRouter()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'dirigente'

  useEffect(() => {
    fetchEventi()
  }, [])

  const fetchEventi = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('eventi')
        .select(`
          *,
          prenotazioni_eventi(count)
        `)
        .order('data_evento', { ascending: true })

      if (error) throw error

      const eventiWithCounts = await Promise.all(
        (data || []).map(async (evento) => {
          const { count: prenotazioniCount } = await supabase
            .from('prenotazioni_eventi')
            .select('*', { count: 'exact', head: true })
            .eq('evento_id', evento.id)

          const { count: presenzeCount } = await supabase
            .from('prenotazioni_eventi')
            .select('*', { count: 'exact', head: true })
            .eq('evento_id', evento.id)
            .eq('presente', true)

          return {
            ...evento,
            prenotazioni_count: prenotazioniCount || 0,
            presenze_count: presenzeCount || 0
          }
        })
      )

      setEventi(eventiWithCounts)
    } catch (error) {
      console.error('Errore nel caricamento degli eventi:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteEvento = async (evento: Evento) => {
    if (!isAdmin) return
    
    const conferma = confirm(
      `Sei sicuro di voler eliminare l'evento "${evento.nome}"?\n\n` +
      `Questa azione eliminerà anche tutte le prenotazioni associate e non può essere annullata.`
    )
    
    if (!conferma) return

    try {
      const supabase = createClient()
      
      // Le prenotazioni verranno eliminate automaticamente grazie alla cascata ON DELETE CASCADE
      const { error } = await supabase
        .from('eventi')
        .delete()
        .eq('id', evento.id)

      if (error) throw error

      // Ricarica la lista eventi
      fetchEventi()
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'evento:', error)
      alert('Errore nell\'eliminazione dell\'evento')
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

  const isPastEvent = (dateString: string) => {
    return new Date(dateString) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const eventiPassati = eventi.filter(e => isPastEvent(e.data_evento))
  const eventiFuturi = eventi.filter(e => !isPastEvent(e.data_evento))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Eventi</h1>
        <Button 
          className="w-full sm:w-auto"
          onClick={() => setShowEventoForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Evento
        </Button>
      </div>

      {eventiFuturi.length === 0 && eventiPassati.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CalendarDays className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun evento presente</h3>
            <p className="text-gray-600 mb-4">Crea il tuo primo evento per iniziare</p>
            <Button onClick={() => setShowEventoForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crea Evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {eventiFuturi.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Prossimi Eventi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventiFuturi.map((evento) => (
                  <Card key={evento.id} className="hover:shadow-lg transition-shadow h-full relative">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteEvento(evento)
                        }}
                        className="absolute top-2 right-2 z-10 p-1 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Link href={`/dashboard/eventi/${evento.id}`} className="block h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg pr-8">{evento.nome}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
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
                          <div className="flex items-center text-gray-600">
                            <Users className="mr-2 h-4 w-4" />
                            {evento.prenotazioni_count} prenotati
                            {evento.max_partecipanti && ` / ${evento.max_partecipanti}`}
                          </div>
                          {evento.costo_persona && (
                            <div className="flex items-center text-gray-600">
                              <Euro className="mr-2 h-4 w-4" />
                              {evento.costo_persona.toFixed(2)} a persona
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {eventiPassati.length > 0 && (
            <div className="space-y-4 mt-8">
              <h2 className="text-xl font-semibold text-gray-600">Eventi Passati</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {eventiPassati.map((evento) => (
                  <Card key={evento.id} className="hover:shadow-lg transition-shadow h-full opacity-75 relative">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteEvento(evento)
                        }}
                        className="absolute top-2 right-2 z-10 p-1 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Link href={`/dashboard/eventi/${evento.id}`} className="block h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg pr-8">{evento.nome}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
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
                          <div className="flex items-center text-gray-600">
                            <Users className="mr-2 h-4 w-4" />
                            {evento.presenze_count} presenti
                            {evento.prenotazioni_count > 0 && ` / ${evento.prenotazioni_count} prenotati`}
                          </div>
                          {evento.costo_persona && evento.presenze_count > 0 && (
                            <div className="flex items-center font-semibold text-green-600">
                              <Euro className="mr-2 h-4 w-4" />
                              Totale: €{(evento.costo_persona * evento.presenze_count).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showEventoForm && (
        <EventoForm
          onClose={() => setShowEventoForm(false)}
          onSuccess={() => {
            setShowEventoForm(false)
            fetchEventi()
          }}
        />
      )}
    </div>
  )
}