'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Package, Search, Filter, History, AlertCircle, Users, User, Calendar, Minus, Upload, Image, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ArticoloMagazzino {
  id: string
  tipo_materiale: string
  nome_articolo: string
  quantita: number
  quantita_iniziale: number
  quantita_minima: number | null
  quantita_assegnata: number
  quantita_disponibile: number
  categoria: string | null
  taglia: string | null
  colore: string | null
  stato: string
  stato_giacenza: 'disponibile' | 'sotto_scorta' | 'esaurito'
  ubicazione: string | null
  codice_tracking: string | null
  foto_url: string | null
  assegnazioni_attive: any[] | null
}

interface FormData {
  tipo_materiale: string
  nome_articolo: string
  quantita_iniziale: number
  quantita_minima: number | null
  categoria: string
  taglia: string
  colore: string
  ubicazione: string
  codice_tracking: string
}

const CATEGORIE = [
  'Palloni',
  'Attrezzatura allenamento',
  'Divise',
  'Accessori',
  'Materiale medico',
  'Altro'
]

const TIPI_MATERIALE = [
  'Pallone',
  'Cono',
  'Ostacolo',
  'Pettorina',
  'Maglia',
  'Pantaloncino',
  'Calzettone',
  'Borsa',
  'Kit medico',
  'Altro'
]

export default function MagazzinoPage() {
  const { profile } = useAuth()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [articoli, setArticoli] = useState<ArticoloMagazzino[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutti')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroSquadra, setFiltroSquadra] = useState<string>('tutte')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    tipo_materiale: '',
    nome_articolo: '',
    quantita_iniziale: 0,
    quantita_minima: null,
    categoria: '',
    taglia: '',
    colore: '',
    ubicazione: '',
    codice_tracking: ''
  })
  
  const [assegnazioneForm, setAssegnazioneForm] = useState({
    assegna_a_squadra: false,
    squadra_id: '',
    quantita_assegnata: 0,
    note_assegnazione: ''
  })
  
  const [squadre, setSquadre] = useState<{id: string, nome: string}[]>([])
  
  // Stati per modali dettaglio e cronologia
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCronologiaModal, setShowCronologiaModal] = useState(false)
  const [showMovimentoModal, setShowMovimentoModal] = useState(false)
  const [selectedArticolo, setSelectedArticolo] = useState<ArticoloMagazzino | null>(null)
  const [movimenti, setMovimenti] = useState<any[]>([])
  const [loadingMovimenti, setLoadingMovimenti] = useState(false)
  
  // Form per movimenti rapidi (perdite/ritrovamenti)
  const [movimentoForm, setMovimentoForm] = useState({
    tipo: 'scarico',
    quantita: 1,
    causale: '',
    note: ''
  })

  const canEdit = profile?.role && ['admin', 'dirigente', 'allenatore'].includes(profile.role)

  useEffect(() => {
    fetchArticoli()
    if (canEdit) {
      fetchSquadre()
    }
  }, [canEdit])

  const fetchArticoli = async () => {
    try {
      const { data, error } = await supabase
        .from('v_magazzino_dettaglio')
        .select('*')
        .order('nome_articolo')

      if (error) throw error
      setArticoli(data || [])
    } catch (error) {
      console.error('Errore nel caricamento articoli:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSquadre = async () => {
    try {
      const { data, error } = await supabase
        .from('squadre')
        .select('id, nome')
        .order('nome')

      if (error) throw error
      setSquadre(data || [])
    } catch (error) {
      console.error('Errore nel caricamento squadre:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalLoading(true)
    setError(null)

    try {
      let foto_url = null

      // Upload foto se presente
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `articoli/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('magazzino')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Errore upload immagine:', uploadError)
          throw new Error('Errore nel caricamento dell\'immagine')
        }

        // Ottieni URL pubblico
        const { data: { publicUrl } } = supabase.storage
          .from('magazzino')
          .getPublicUrl(filePath)

        foto_url = publicUrl
      }

      // Crea l'articolo con l'URL della foto
      const { data: articolo, error: insertError } = await supabase
        .from('magazzino')
        .insert({
          tipo_materiale: formData.tipo_materiale,
          nome_articolo: formData.nome_articolo,
          quantita: formData.quantita_iniziale,
          quantita_iniziale: formData.quantita_iniziale,
          quantita_minima: formData.quantita_minima,
          categoria: formData.categoria || null,
          taglia: formData.taglia || null,
          colore: formData.colore || null,
          ubicazione: formData.ubicazione || null,
          codice_tracking: formData.codice_tracking || null,
          foto_url: foto_url,
          stato: 'disponibile'
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Registra il movimento iniziale solo per tracciamento (non modifica quantità)
      if (articolo && formData.quantita_iniziale > 0) {
        const { error: movimentoError } = await supabase
          .rpc('registra_movimento_magazzino', {
            p_materiale_id: articolo.id,
            p_tipo_movimento: 'inventario_iniziale',
            p_quantita: formData.quantita_iniziale,
            p_causale: 'Inventario iniziale - Creazione articolo'
          })

        if (movimentoError) throw movimentoError
      }

      // Se richiesto, assegna a squadra
      if (articolo && assegnazioneForm.assegna_a_squadra && assegnazioneForm.squadra_id) {
        const { error: assegnazioneError } = await supabase
          .rpc('assegna_materiale_squadra', {
            p_materiale_id: articolo.id,
            p_squadra_id: assegnazioneForm.squadra_id,
            p_quantita: assegnazioneForm.quantita_assegnata || formData.quantita_iniziale,
            p_note: assegnazioneForm.note_assegnazione || null
          })

        if (assegnazioneError) throw assegnazioneError
      }

      // Reset form e chiudi modal
      setFormData({
        tipo_materiale: '',
        nome_articolo: '',
        quantita_iniziale: 0,
        quantita_minima: null,
        categoria: '',
        taglia: '',
        colore: '',
        ubicazione: '',
        codice_tracking: ''
      })
      setAssegnazioneForm({
        assegna_a_squadra: false,
        squadra_id: '',
        quantita_assegnata: 0,
        note_assegnazione: ''
      })
      setShowModal(false)
      setSelectedFile(null)
      setImagePreview(null)
      fetchArticoli()
    } catch (error: any) {
      console.error('Errore nel salvataggio:', error)
      setError(error.message || 'Errore nel salvataggio dell\'articolo')
    } finally {
      setModalLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('quantita') ? (value ? parseInt(value) : 0) : value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Verifica tipo file
      if (!file.type.startsWith('image/')) {
        setError('Per favore seleziona un file immagine')
        return
      }
      
      // Verifica dimensione (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('L\'immagine deve essere inferiore a 5MB')
        return
      }

      setSelectedFile(file)
      setError(null)

      // Crea preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const articoliFiltrati = articoli.filter(articolo => {
    if (filtroCategoria !== 'tutti' && articolo.categoria !== filtroCategoria) return false
    if (filtroStato !== 'tutti' && articolo.stato_giacenza !== filtroStato) return false
    if (filtroSquadra !== 'tutte') {
      const hasAssegnazione = articolo.assegnazioni_attive?.some((ass: any) => ass.squadra_id === filtroSquadra)
      if (!hasAssegnazione) return false
    }
    if (searchTerm && !articolo.nome_articolo.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !articolo.tipo_materiale.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const categorie = Array.from(new Set(articoli.map(a => a.categoria).filter(Boolean)))
  
  // Estrai squadre uniche dagli articoli con assegnazioni
  const squadreConMateriale = Array.from(new Set(
    articoli.flatMap(a => 
      a.assegnazioni_attive?.map((ass: any) => JSON.stringify({
        id: ass.squadra_id, 
        nome: ass.squadra_nome
      })) || []
    )
  )).map(s => JSON.parse(s))

  const openDetailModal = (articolo: ArticoloMagazzino) => {
    setSelectedArticolo(articolo)
    setShowDetailModal(true)
  }

  const openCronologiaModal = async (articolo: ArticoloMagazzino) => {
    setSelectedArticolo(articolo)
    setShowCronologiaModal(true)
    setLoadingMovimenti(true)
    
    try {
      const { data, error } = await supabase
        .from('v_cronologia_movimenti')
        .select('*')
        .eq('materiale_id', articolo.id)
        .order('data_movimento', { ascending: false })

      if (error) throw error
      setMovimenti(data || [])
    } catch (error) {
      console.error('Errore nel caricamento movimenti:', error)
    } finally {
      setLoadingMovimenti(false)
    }
  }

  const openMovimentoModal = (articolo: ArticoloMagazzino) => {
    setSelectedArticolo(articolo)
    setMovimentoForm({
      tipo: 'scarico',
      quantita: 1,
      causale: '',
      note: ''
    })
    setShowMovimentoModal(true)
  }

  const handleMovimentoRapido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArticolo) return

    try {
      const { error } = await supabase.rpc('registra_movimento_magazzino', {
        p_materiale_id: selectedArticolo.id,
        p_tipo_movimento: movimentoForm.tipo,
        p_quantita: movimentoForm.quantita,
        p_causale: movimentoForm.causale,
        p_note: movimentoForm.note || null
      })

      if (error) throw error

      setShowMovimentoModal(false)
      setMovimentoForm({
        tipo: 'scarico',
        quantita: 1,
        causale: '',
        note: ''
      })
      fetchArticoli()
    } catch (error: any) {
      alert(error.message || 'Errore nel registrare il movimento')
    }
  }

  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case 'disponibile':
        return <Badge className="bg-green-100 text-green-800">Disponibile</Badge>
      case 'sotto_scorta':
        return <Badge className="bg-yellow-100 text-yellow-800">Sotto scorta</Badge>
      case 'esaurito':
        return <Badge className="bg-red-100 text-red-800">Esaurito</Badge>
      default:
        return <Badge>{stato}</Badge>
    }
  }

  const totaleMateriale = articoli.length
  const materialeDisponibile = articoli.filter(a => a.stato_giacenza === 'disponibile').length
  const materialeSottoScorta = articoli.filter(a => a.stato_giacenza === 'sotto_scorta').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Caricamento magazzino...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Magazzino</h1>
          <p className="mt-2 text-gray-600">
            Monitora e gestisci l'inventario dei materiali sportivi
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/magazzino/assegnazioni">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Assegnazioni
            </Button>
          </Link>
          {canEdit && (
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Articolo
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuovo Articolo</DialogTitle>
              </DialogHeader>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tipo Materiale *
                    </label>
                    <select
                      name="tipo_materiale"
                      value={formData.tipo_materiale}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Seleziona tipo</option>
                      {TIPI_MATERIALE.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nome Articolo *
                    </label>
                    <input
                      type="text"
                      name="nome_articolo"
                      value={formData.nome_articolo}
                      onChange={handleChange}
                      required
                      placeholder="es. Pallone Adidas Size 5"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Quantità Iniziale *
                    </label>
                    <input
                      type="number"
                      name="quantita_iniziale"
                      value={formData.quantita_iniziale}
                      onChange={handleChange}
                      required
                      min="0"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Scorta Minima
                    </label>
                    <input
                      type="number"
                      name="quantita_minima"
                      value={formData.quantita_minima || ''}
                      onChange={handleChange}
                      min="0"
                      placeholder="Avviso quando sotto questa quantità"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Categoria
                    </label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Seleziona categoria</option>
                      {CATEGORIE.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Ubicazione
                    </label>
                    <input
                      type="text"
                      name="ubicazione"
                      value={formData.ubicazione}
                      onChange={handleChange}
                      placeholder="es. Magazzino A - Scaffale 3"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Taglia
                    </label>
                    <input
                      type="text"
                      name="taglia"
                      value={formData.taglia}
                      onChange={handleChange}
                      placeholder="es. L, XL, 5"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Colore
                    </label>
                    <input
                      type="text"
                      name="colore"
                      value={formData.colore}
                      onChange={handleChange}
                      placeholder="es. Rosso, Blu"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Codice Tracking
                  </label>
                  <input
                    type="text"
                    name="codice_tracking"
                    value={formData.codice_tracking}
                    onChange={handleChange}
                    placeholder="Codice univoco per tracking (opzionale)"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                {/* Campo upload foto */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Foto Articolo
                  </label>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label htmlFor="foto-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        {imagePreview ? (
                          <div className="relative w-full h-full">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                setSelectedFile(null)
                                setImagePreview(null)
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500">
                              <span className="font-semibold">Clicca per caricare</span> o trascina qui
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG o WEBP (MAX. 5MB)</p>
                          </div>
                        )}
                        <input
                          id="foto-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Sezione assegnazione squadra */}
                <div className="md:col-span-2 border-t pt-4 mt-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="assegna_a_squadra"
                      checked={assegnazioneForm.assegna_a_squadra}
                      onChange={(e) => setAssegnazioneForm({
                        ...assegnazioneForm, 
                        assegna_a_squadra: e.target.checked,
                        quantita_assegnata: e.target.checked ? formData.quantita_iniziale : 0
                      })}
                      className="mr-2"
                    />
                    <label htmlFor="assegna_a_squadra" className="text-sm font-medium">
                      Assegna subito a una squadra
                    </label>
                  </div>

                  {assegnazioneForm.assegna_a_squadra && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Squadra *
                        </label>
                        <select
                          value={assegnazioneForm.squadra_id}
                          onChange={(e) => setAssegnazioneForm({
                            ...assegnazioneForm, 
                            squadra_id: e.target.value
                          })}
                          className="w-full px-3 py-2 border rounded-md"
                          required={assegnazioneForm.assegna_a_squadra}
                        >
                          <option value="">Seleziona squadra</option>
                          {squadre.map(squadra => (
                            <option key={squadra.id} value={squadra.id}>{squadra.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Quantità da assegnare
                        </label>
                        <input
                          type="number"
                          value={assegnazioneForm.quantita_assegnata}
                          onChange={(e) => setAssegnazioneForm({
                            ...assegnazioneForm, 
                            quantita_assegnata: parseInt(e.target.value) || 0
                          })}
                          min="0"
                          max={formData.quantita_iniziale}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Max: {formData.quantita_iniziale} (tutta la quantità iniziale)
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">
                          Note assegnazione
                        </label>
                        <textarea
                          value={assegnazioneForm.note_assegnazione}
                          onChange={(e) => setAssegnazioneForm({
                            ...assegnazioneForm, 
                            note_assegnazione: e.target.value
                          })}
                          rows={2}
                          placeholder="es. Per allenamenti stagione 2024/25"
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={modalLoading}>
                    {modalLoading ? 'Salvataggio...' : 'Salva Articolo'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                  >
                    Annulla
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Totale Articoli</p>
                <p className="text-2xl font-bold">{totaleMateriale}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disponibili</p>
                <p className="text-2xl font-bold text-green-600">{materialeDisponibile}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sotto Scorta</p>
                <p className="text-2xl font-bold text-yellow-600">{materialeSottoScorta}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtri e ricerca */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Cerca articoli..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md"
                />
              </div>
            </div>
            <div>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="tutti">Tutte le categorie</option>
                {categorie.map(cat => (
                  <option key={cat} value={cat || ''}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="tutti">Tutti gli stati</option>
                <option value="disponibile">Disponibile</option>
                <option value="sotto_scorta">Sotto scorta</option>
                <option value="esaurito">Esaurito</option>
              </select>
            </div>
            <div>
              <select
                value={filtroSquadra}
                onChange={(e) => setFiltroSquadra(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="tutte">Tutte le squadre</option>
                {squadreConMateriale.map(squadra => (
                  <option key={squadra.id} value={squadra.id}>{squadra.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista articoli */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articoliFiltrati.map(articolo => (
          <Card key={articolo.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              {/* Immagine articolo */}
              {articolo.foto_url && (
                <div className="mb-4 w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={articolo.foto_url} 
                    alt={articolo.nome_articolo}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{articolo.nome_articolo}</h3>
                  <p className="text-sm text-gray-500">{articolo.tipo_materiale}</p>
                  {articolo.categoria && (
                    <p className="text-sm text-gray-500">{articolo.categoria}</p>
                  )}
                </div>
                {getStatoBadge(articolo.stato_giacenza)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Quantità totale:</span>
                  <span className="font-medium">{articolo.quantita}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Assegnati:</span>
                  <span className="font-medium">{articolo.quantita_assegnata}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Disponibili:</span>
                  <span className="font-medium text-green-600">{articolo.quantita_disponibile}</span>
                </div>
              </div>

              {articolo.stato_giacenza === 'sotto_scorta' && (
                <div className="mb-4 p-2 bg-yellow-50 rounded flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">Sotto scorta minima</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openDetailModal(articolo)}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Dettagli
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openCronologiaModal(articolo)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    Cronologia
                  </Button>
                </div>
                
                {canEdit && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setSelectedArticolo(articolo)
                        setMovimentoForm({
                          tipo: 'scarico',
                          quantita: 1,
                          causale: 'Materiale perso',
                          note: ''
                        })
                        setShowMovimentoModal(true)
                      }}
                    >
                      <Minus className="mr-1 h-3 w-3" />
                      Perso
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => {
                        setSelectedArticolo(articolo)
                        setMovimentoForm({
                          tipo: 'carico',
                          quantita: 1,
                          causale: 'Materiale ritrovato',
                          note: ''
                        })
                        setShowMovimentoModal(true)
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Ritrovato
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {articoliFiltrati.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun articolo trovato</p>
          </CardContent>
        </Card>
      )}

      {/* Modal Dettaglio Articolo */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettaglio Articolo</DialogTitle>
          </DialogHeader>
          
          {selectedArticolo && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedArticolo.nome_articolo}</h2>
                  <p className="text-gray-500">{selectedArticolo.tipo_materiale}</p>
                  {selectedArticolo.categoria && <p className="text-gray-500">{selectedArticolo.categoria}</p>}
                </div>
                {getStatoBadge(selectedArticolo.stato_giacenza)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Quantità</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Quantità totale:</span>
                      <span className="font-medium">{selectedArticolo.quantita}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quantità iniziale:</span>
                      <span>{selectedArticolo.quantita_iniziale}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assegnati:</span>
                      <span className="font-medium">{selectedArticolo.quantita_assegnata}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Disponibili per assegnazione:</span>
                      <span className="font-medium text-green-600">{selectedArticolo.quantita_disponibile}</span>
                    </div>
                    {selectedArticolo.quantita_minima !== null && (
                      <div className="flex justify-between">
                        <span>Scorta minima:</span>
                        <span>{selectedArticolo.quantita_minima}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Dettagli</h3>
                  <div className="space-y-2">
                    {selectedArticolo.taglia && (
                      <div className="flex justify-between">
                        <span>Taglia:</span>
                        <span>{selectedArticolo.taglia}</span>
                      </div>
                    )}
                    {selectedArticolo.colore && (
                      <div className="flex justify-between">
                        <span>Colore:</span>
                        <span>{selectedArticolo.colore}</span>
                      </div>
                    )}
                    {selectedArticolo.ubicazione && (
                      <div className="flex justify-between">
                        <span>Ubicazione:</span>
                        <span>{selectedArticolo.ubicazione}</span>
                      </div>
                    )}
                    {selectedArticolo.codice_tracking && (
                      <div className="flex justify-between">
                        <span>Codice tracking:</span>
                        <span>{selectedArticolo.codice_tracking}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assegnazioni attive */}
              {selectedArticolo.assegnazioni_attive && selectedArticolo.assegnazioni_attive.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Assegnazioni Attive
                  </h3>
                  <div className="space-y-2">
                    {selectedArticolo.assegnazioni_attive.map((ass: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span>{ass.squadra_nome}</span>
                        <div>
                          <span className="font-medium">{ass.quantita} pz</span>
                          <span className="text-sm text-gray-500 ml-2">
                            dal {new Date(ass.data_assegnazione).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Azioni rapide */}
              {canEdit && (
                <div className="pt-6 border-t">
                  <h3 className="font-semibold mb-3">Azioni Rapide</h3>
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={() => {
                        setMovimentoForm({
                          tipo: 'scarico',
                          quantita: 1,
                          causale: 'Materiale perso',
                          note: ''
                        })
                        setShowMovimentoModal(true)
                        setShowDetailModal(false)
                      }}
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Minus className="mr-2 h-4 w-4" />
                      Segna come Perso
                    </Button>
                    <Button
                      onClick={() => {
                        setMovimentoForm({
                          tipo: 'carico',
                          quantita: 1,
                          causale: 'Materiale ritrovato',
                          note: ''
                        })
                        setShowMovimentoModal(true)
                        setShowDetailModal(false)
                      }}
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Segna come Ritrovato
                    </Button>
                    <Button
                      onClick={() => openMovimentoModal(selectedArticolo!)}
                      variant="outline"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Altro Movimento
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Cronologia */}
      <Dialog open={showCronologiaModal} onOpenChange={setShowCronologiaModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cronologia Movimenti</DialogTitle>
          </DialogHeader>
          
          {selectedArticolo && (
            <div>
              <p className="text-gray-500 mb-6">
                {selectedArticolo.nome_articolo} - {selectedArticolo.tipo_materiale}
              </p>

              {loadingMovimenti ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2">Caricamento cronologia...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {movimenti.map((movimento) => (
                    <div key={movimento.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getTipoMovimentoIcon(movimento.tipo_movimento)}
                          <div>
                            {getTipoMovimentoBadge(movimento.tipo_movimento)}
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(movimento.data_movimento).toLocaleString('it-IT')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">
                            {movimento.tipo_movimento === 'rettifica' ? (
                              <span>{movimento.quantita_prima} → {movimento.quantita_dopo}</span>
                            ) : movimento.tipo_movimento === 'assegnazione' ? (
                              <span className="text-blue-600">↓ {movimento.quantita}</span>
                            ) : (
                              <span className={movimento.tipo_movimento === 'carico' || movimento.tipo_movimento === 'restituzione' ? 'text-green-600' : 'text-red-600'}>
                                {movimento.tipo_movimento === 'carico' || movimento.tipo_movimento === 'restituzione' ? '+' : '-'}
                                {movimento.quantita}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            Giacenza: {movimento.quantita_dopo}
                          </p>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <p className="font-medium mb-2">{movimento.causale}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{movimento.utente_nome}</span>
                          </div>
                          {movimento.squadra_nome && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{movimento.squadra_nome}</span>
                            </div>
                          )}
                        </div>

                        {movimento.note && (
                          <p className="mt-2 text-sm text-gray-600 italic">
                            Note: {movimento.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {movimenti.length === 0 && (
                    <div className="text-center py-8">
                      <History className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-4 text-gray-500">Nessun movimento registrato</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Movimento Rapido */}
      <Dialog open={showMovimentoModal} onOpenChange={setShowMovimentoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Movimento</DialogTitle>
          </DialogHeader>
          
          {selectedArticolo && (
            <form onSubmit={handleMovimentoRapido} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Articolo: <span className="font-medium">{selectedArticolo.nome_articolo}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tipo Movimento</label>
                <select
                  value={movimentoForm.tipo}
                  onChange={(e) => setMovimentoForm({...movimentoForm, tipo: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="scarico">Scarico (perdita/danno)</option>
                  <option value="carico">Carico (ritrovamento/acquisto)</option>
                  <option value="rettifica">Rettifica inventario</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {movimentoForm.tipo === 'rettifica' ? 'Nuova Quantità Totale' : 'Quantità'}
                </label>
                <input
                  type="number"
                  value={movimentoForm.quantita}
                  onChange={(e) => setMovimentoForm({...movimentoForm, quantita: parseInt(e.target.value) || 0})}
                  min={movimentoForm.tipo === 'rettifica' ? "0" : "1"}
                  max={movimentoForm.tipo === 'scarico' ? selectedArticolo.quantita : undefined}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
                {movimentoForm.tipo === 'scarico' && (
                  <p className="text-sm text-gray-500 mt-1">
                    Massimo: {selectedArticolo.quantita} (quantità attuale)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Causale *</label>
                <input
                  type="text"
                  value={movimentoForm.causale}
                  onChange={(e) => setMovimentoForm({...movimentoForm, causale: e.target.value})}
                  placeholder="es. 2 palloni bucati, 1 pettorina strappata..."
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Note (opzionale)</label>
                <textarea
                  value={movimentoForm.note}
                  onChange={(e) => setMovimentoForm({...movimentoForm, note: e.target.value})}
                  rows={3}
                  placeholder="Descrizione dettagliata del movimento..."
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit">
                  {movimentoForm.tipo === 'scarico' ? 'Registra Perdita' : 
                   movimentoForm.tipo === 'carico' ? 'Registra Ritrovamento' : 
                   'Registra Movimento'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowMovimentoModal(false)}
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

const getTipoMovimentoIcon = (tipo: string) => {
  switch (tipo) {
    case 'carico':
    case 'inventario_iniziale':
      return <Plus className="h-5 w-5 text-green-600" />
    case 'scarico':
      return <Minus className="h-5 w-5 text-red-600" />
    case 'assegnazione':
      return <Users className="h-5 w-5 text-blue-600" />
    case 'restituzione':
      return <Package className="h-5 w-5 text-purple-600" />
    default:
      return <Package className="h-5 w-5 text-gray-600" />
  }
}

const getTipoMovimentoBadge = (tipo: string) => {
  switch (tipo) {
    case 'carico':
      return <Badge className="bg-green-100 text-green-800">+ Carico</Badge>
    case 'scarico':
      return <Badge className="bg-red-100 text-red-800">- Scarico</Badge>
    case 'assegnazione':
      return <Badge className="bg-blue-100 text-blue-800">→ Assegnazione</Badge>
    case 'restituzione':
      return <Badge className="bg-purple-100 text-purple-800">← Restituzione</Badge>
    case 'rettifica':
      return <Badge className="bg-gray-100 text-gray-800">↻ Rettifica</Badge>
    case 'inventario_iniziale':
      return <Badge className="bg-yellow-100 text-yellow-800">▣ Inventario</Badge>
    default:
      return <Badge>{tipo}</Badge>
  }
}