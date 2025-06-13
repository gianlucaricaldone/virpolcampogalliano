'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package, Users } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface AssegnazioneMateriale {
  id: string
  materiale_id: string
  nome_articolo: string
  tipo_materiale: string
  categoria: string | null
  quantita: number
  quantita_restituita: number
  data_assegnazione: string
  data_restituzione: string | null
  stato: 'attiva' | 'restituita' | 'parziale'
  note: string | null
  condizione_restituzione: string | null
}

interface SquadraInfo {
  id: string
  nome: string
  categoria: string
}

export default function MagazzinoSquadraPage() {
  const params = useParams()
  const supabase = createClientComponentClient()
  const [assegnazioni, setAssegnazioni] = useState<AssegnazioneMateriale[]>([])
  const [squadra, setSquadra] = useState<SquadraInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStato, setFiltroStato] = useState<string>('tutti')

  useEffect(() => {
    fetchData()
  }, [params.squadraId])

  const fetchData = async () => {
    try {
      // Fetch squadra info
      const { data: squadraData, error: squadraError } = await supabase
        .from('squadre')
        .select('id, nome, categoria')
        .eq('id', params.squadraId)
        .single()

      if (squadraError) throw squadraError
      setSquadra(squadraData)

      // Fetch assegnazioni
      const { data: assegnazioniData, error: assegnazioniError } = await supabase
        .from('assegnazioni_materiale')
        .select(`
          *,
          magazzino:materiale_id (
            nome_articolo,
            tipo_materiale,
            categoria
          )
        `)
        .eq('squadra_id', params.squadraId)
        .order('data_assegnazione', { ascending: false })

      if (assegnazioniError) throw assegnazioniError

      // Flatten dei dati
      const assegnazioniFlat = assegnazioniData?.map(item => ({
        ...item,
        nome_articolo: item.magazzino?.nome_articolo || '',
        tipo_materiale: item.magazzino?.tipo_materiale || '',
        categoria: item.magazzino?.categoria || null
      })) || []

      setAssegnazioni(assegnazioniFlat)
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
    } finally {
      setLoading(false)
    }
  }

  const assegnazioniFiltrate = assegnazioni.filter(assegnazione => {
    if (filtroStato !== 'tutti' && assegnazione.stato !== filtroStato) return false
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

  const totaleMaterialeAttivo = assegnazioni
    .filter(a => a.stato === 'attiva')
    .reduce((acc, a) => acc + a.quantita, 0)

  const totaleMaterialeRestituito = assegnazioni
    .filter(a => a.stato === 'restituita')
    .reduce((acc, a) => acc + a.quantita, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Caricamento materiale squadra...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/dashboard/magazzino">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna al magazzino
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8" />
          Materiale Squadra
        </h1>
        {squadra && (
          <p className="text-gray-500 mt-2">
            {squadra.nome} - {squadra.categoria}
          </p>
        )}
      </div>

      {/* Riepilogo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Materiale Attivo</h3>
          <p className="text-2xl font-bold text-green-600">{totaleMaterialeAttivo}</p>
          <p className="text-sm text-gray-500">pezzi assegnati</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Materiale Restituito</h3>
          <p className="text-2xl font-bold text-gray-600">{totaleMaterialeRestituito}</p>
          <p className="text-sm text-gray-500">pezzi restituiti</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Assegnazioni Totali</h3>
          <p className="text-2xl font-bold text-blue-600">{assegnazioni.length}</p>
          <p className="text-sm text-gray-500">movimenti registrati</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Filtra per stato</label>
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="tutti">Tutti gli stati</option>
          <option value="attiva">Attive</option>
          <option value="restituita">Restituite</option>
          <option value="parziale">Parziali</option>
        </select>
      </div>

      {/* Lista assegnazioni */}
      <div className="space-y-4">
        {assegnazioniFiltrate.map((assegnazione) => (
          <div key={assegnazione.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{assegnazione.nome_articolo}</h3>
                <p className="text-gray-500">{assegnazione.tipo_materiale}</p>
                {assegnazione.categoria && (
                  <p className="text-sm text-gray-500">{assegnazione.categoria}</p>
                )}
              </div>
              {getStatoBadge(assegnazione.stato)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Quantità assegnata</p>
                <p className="font-semibold">{assegnazione.quantita} pz</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data assegnazione</p>
                <p className="font-semibold">
                  {new Date(assegnazione.data_assegnazione).toLocaleDateString('it-IT')}
                </p>
              </div>
              {assegnazione.quantita_restituita > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Quantità restituita</p>
                  <p className="font-semibold">{assegnazione.quantita_restituita} pz</p>
                </div>
              )}
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

            {assegnazione.condizione_restituzione && (
              <div className="mb-3">
                <p className="text-sm text-gray-500">Condizioni restituzione</p>
                <p className="text-sm">{assegnazione.condizione_restituzione}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Link href={`/dashboard/magazzino/${assegnazione.materiale_id}`}>
                <Button variant="outline" size="sm">
                  <Package className="mr-2 h-4 w-4" />
                  Dettagli Articolo
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {assegnazioniFiltrate.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">
            {filtroStato === 'tutti' 
              ? 'Nessun materiale assegnato a questa squadra'
              : `Nessuna assegnazione ${filtroStato} trovata`
            }
          </p>
        </div>
      )}
    </div>
  )
}