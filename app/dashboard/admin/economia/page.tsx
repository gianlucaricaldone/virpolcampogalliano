'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, DollarSign, TrendingUp, TrendingDown, Euro, Calendar, User, Receipt } from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Database } from '@/types/database'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale)

type MovimentoEconomico = Database['public']['Tables']['movimenti_economici']['Row']
type CategoriaEconomica = Database['public']['Tables']['categorie_economiche']['Row']
type EconomiaStats = Database['public']['Views']['v_economia_stats']['Row']
type Tesserato = Database['public']['Tables']['tesserati']['Row']
type TesseratoSelect = Pick<Tesserato, 'id' | 'nome' | 'cognome'>

interface FormMovimento {
  tipo: 'entrata' | 'uscita'
  categoria: string
  sottocategoria: string
  importo: string
  descrizione: string
  data_movimento: string
  metodo_pagamento: string
  riferimento: string
  note: string
  tesserato_id: string
}

export default function EconomiaPage() {
  const { profile, hasRole } = useAuth()
  const supabase = createClientComponentClient<Database>()
  
  const [loading, setLoading] = useState(true)
  const [modalLoading, setModalLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  
  const [movimenti, setMovimenti] = useState<MovimentoEconomico[]>([])
  const [categorie, setCategorie] = useState<CategoriaEconomica[]>([])
  const [tesserati, setTesserati] = useState<TesseratoSelect[]>([])
  const [stats, setStats] = useState<EconomiaStats[]>([])
  
  const [formData, setFormData] = useState<FormMovimento>({
    tipo: 'entrata',
    categoria: '',
    sottocategoria: '',
    importo: '',
    descrizione: '', 
    data_movimento: new Date().toISOString().split('T')[0],
    metodo_pagamento: 'contanti',
    riferimento: '',
    note: '',
    tesserato_id: ''
  })

  // Check authorization after all hooks
  if (!hasRole('admin')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-red-500 mb-4">Accesso negato</p>
            <p className="text-gray-500">
              Solo gli amministratori possono accedere a questa sezione
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load categorie
      const { data: categorieData, error: categorieError } = await supabase
        .from('categorie_economiche')
        .select('*')
        .eq('attiva', true)
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true })
      
      if (categorieError) throw categorieError
      setCategorie(categorieData || [])
      
      // Load movimenti economici
      const { data: movimentiData, error: movimentiError } = await supabase
        .from('movimenti_economici')
        .select('*')
        .order('data_movimento', { ascending: false })
        .limit(100)
        
      if (movimentiError) throw movimentiError
      setMovimenti(movimentiData || [])
      
      // Load tesserati for payment linking
      const { data: tesseratiData, error: tesseratiError } = await supabase
        .from('tesserati')
        .select('id, nome, cognome')
        .eq('stato', true)
        .order('cognome', { ascending: true })
        
      if (tesseratiError) throw tesseratiError
      setTesserati(tesseratiData || [])
      
      // Load stats
      const { data: statsData, error: statsError } = await supabase
        .from('v_economia_stats')
        .select('*')
        
      if (statsError) throw statsError
      setStats(statsData || [])
      
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error instanceof Error ? error.message : 'Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    
    try {
      setModalLoading(true)
      setModalError(null)
      
      const importoNumerico = parseFloat(formData.importo)
      if (isNaN(importoNumerico) || importoNumerico <= 0) {
        throw new Error('Inserire un importo valido maggiore di zero')
      }
      
      const movimento = {
        tipo: formData.tipo,
        categoria: formData.categoria,
        sottocategoria: formData.sottocategoria || null,
        importo: importoNumerico,
        descrizione: formData.descrizione,
        data_movimento: formData.data_movimento,
        metodo_pagamento: formData.metodo_pagamento,
        riferimento: formData.riferimento || null,
        note: formData.note || null,
        tesserato_id: formData.tesserato_id || null,
        created_by: profile.id
      }
      
      const { error: insertError } = await supabase
        .from('movimenti_economici')
        .insert([movimento])
        
      if (insertError) throw insertError
      
      // Reset form and close modal
      setFormData({
        tipo: 'entrata',
        categoria: '',
        sottocategoria: '',
        importo: '',
        descrizione: '',
        data_movimento: new Date().toISOString().split('T')[0],
        metodo_pagamento: 'contanti',
        riferimento: '',
        note: '',
        tesserato_id: ''
      })
      
      setShowModal(false)
      await loadData() // Reload data
      
    } catch (error) {
      console.error('Error creating movimento:', error)
      setModalError(error instanceof Error ? error.message : 'Errore nel salvare il movimento')
    } finally {
      setModalLoading(false)
    }
  }

  // Calculate totals for stats cards
  const totaleEntrate = stats
    .filter(s => s.tipo === 'entrata')
    .reduce((sum, s) => sum + s.totale, 0)
    
  const totaleUscite = stats
    .filter(s => s.tipo === 'uscita')
    .reduce((sum, s) => sum + s.totale, 0)
    
  const bilancio = totaleEntrate - totaleUscite

  // Prepare chart data
  const entrateByCategory = stats.filter(s => s.tipo === 'entrata')
  const usciteByCategory = stats.filter(s => s.tipo === 'uscita')
  
  const entrateChartData = {
    labels: entrateByCategory.map(s => s.categoria),
    datasets: [{
      data: entrateByCategory.map(s => s.totale),
      backgroundColor: entrateByCategory.map(s => {
        const categoria = categorie.find(c => c.nome === s.categoria)
        return categoria?.colore || '#6b7280'
      }),
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  }
  
  const usciteChartData = {
    labels: usciteByCategory.map(s => s.categoria),
    datasets: [{
      data: usciteByCategory.map(s => s.totale),
      backgroundColor: usciteByCategory.map(s => {
        const categoria = categorie.find(c => c.nome === s.categoria)
        return categoria?.colore || '#6b7280'
      }),
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed
            return `${context.label}: €${value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
          }
        }
      }
    }
  }

  const categorieDisponibili = categorie.filter(c => 
    c.tipo === formData.tipo || c.tipo === 'entrambi'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Caricamento dati economici...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Economia</h1>
          <p className="mt-2 text-gray-600">
            Monitora entrate, uscite e bilancio della società
          </p>
        </div>
        
        <Dialog open={showModal} onOpenChange={(open) => {
          setShowModal(open)
          if (open) {
            setModalError(null)
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Movimento
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aggiungi Movimento Economico</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {modalError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo Movimento</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(value: 'entrata' | 'uscita') => 
                      setFormData({...formData, tipo: value, categoria: ''})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrata">
                        <div className="flex items-center">
                          <TrendingUp className="mr-2 h-4 w-4 text-green-600" />
                          Entrata
                        </div>
                      </SelectItem>
                      <SelectItem value="uscita">
                        <div className="flex items-center">
                          <TrendingDown className="mr-2 h-4 w-4 text-red-600" />
                          Uscita
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="importo">Importo (€)</Label>
                  <Input
                    id="importo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.importo}
                    onChange={(e) => setFormData({...formData, importo: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select 
                    value={formData.categoria} 
                    onValueChange={(value) => setFormData({...formData, categoria: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorieDisponibili.map((categoria) => (
                        <SelectItem key={categoria.id} value={categoria.nome}>
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: categoria.colore }}
                            />
                            {categoria.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sottocategoria">Sottocategoria (opzionale)</Label>
                  <Input
                    id="sottocategoria"
                    value={formData.sottocategoria}
                    onChange={(e) => setFormData({...formData, sottocategoria: e.target.value})}
                    placeholder="es. Quota mensile, Cena sociale..."
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descrizione">Descrizione</Label>
                <Input
                  id="descrizione"
                  value={formData.descrizione}
                  onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
                  placeholder="Descrizione del movimento..."
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_movimento">Data</Label>
                  <Input
                    id="data_movimento"
                    type="date"
                    value={formData.data_movimento}
                    onChange={(e) => setFormData({...formData, data_movimento: e.target.value})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="metodo_pagamento">Metodo Pagamento</Label>
                  <Select 
                    value={formData.metodo_pagamento} 
                    onValueChange={(value) => setFormData({...formData, metodo_pagamento: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contanti">Contanti</SelectItem>
                      <SelectItem value="bonifico">Bonifico</SelectItem>
                      <SelectItem value="carta">Carta</SelectItem>
                      <SelectItem value="assegno">Assegno</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {formData.categoria === 'Quote Tesseramento' && (
                <div className="space-y-2">
                  <Label htmlFor="tesserato_id">Tesserato (opzionale)</Label>
                  <Select 
                    value={formData.tesserato_id} 
                    onValueChange={(value) => setFormData({...formData, tesserato_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tesserato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Nessuno --</SelectItem>
                      {tesserati.map((tesserato) => (
                        <SelectItem key={tesserato.id} value={tesserato.id}>
                          {tesserato.cognome} {tesserato.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="riferimento">Riferimento (opzionale)</Label>
                  <Input
                    id="riferimento"
                    value={formData.riferimento}
                    onChange={(e) => setFormData({...formData, riferimento: e.target.value})}
                    placeholder="N. fattura, ricevuta..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="note">Note (opzionale)</Label>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({...formData, note: e.target.value})}
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowModal(false)}
                  disabled={modalLoading}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={modalLoading || !formData.categoria || !formData.descrizione}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {modalLoading ? 'Salvando...' : 'Salva Movimento'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Entrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              €{totaleEntrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.filter(s => s.tipo === 'entrata').reduce((sum, s) => sum + s.numero_movimenti, 0)} movimenti
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Uscite</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              €{totaleUscite.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.filter(s => s.tipo === 'uscita').reduce((sum, s) => sum + s.numero_movimenti, 0)} movimenti
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bilancio</CardTitle>
            <Euro className={`h-4 w-4 ${bilancio >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${bilancio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{bilancio.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {bilancio >= 0 ? 'Positivo' : 'Negativo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
              Entrate per Categoria
            </CardTitle>
            <CardDescription>Distribuzione delle entrate per categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {entrateByCategory.length > 0 ? (
              <div className="h-80">
                <Doughnut data={entrateChartData} options={chartOptions} />
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nessuna entrata registrata</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="mr-2 h-5 w-5 text-red-600" />
              Uscite per Categoria
            </CardTitle>
            <CardDescription>Distribuzione delle uscite per categoria</CardDescription>
          </CardHeader>
          <CardContent>
            {usciteByCategory.length > 0 ? (
              <div className="h-80">
                <Doughnut data={usciteChartData} options={chartOptions} />
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nessuna uscita registrata</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle>Movimenti Recenti</CardTitle>
          <CardDescription>Ultimi 10 movimenti economici registrati</CardDescription>
        </CardHeader>
        <CardContent>
          {movimenti.length > 0 ? (
            <div className="space-y-3">
              {movimenti.slice(0, 10).map((movimento) => {
                const categoria = categorie.find(c => c.nome === movimento.categoria)
                const tesserato = tesserati.find(t => t.id === movimento.tesserato_id)
                
                return (
                  <div key={movimento.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: categoria?.colore || '#6b7280' }}
                      />
                      <div>
                        <div className="font-medium">{movimento.descrizione}</div>
                        <div className="text-sm text-gray-500">
                          {movimento.categoria}
                          {movimento.sottocategoria && ` • ${movimento.sottocategoria}`}
                          {tesserato && (
                            <span className="ml-2 inline-flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {tesserato.cognome} {tesserato.nome}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(movimento.data_movimento).toLocaleDateString('it-IT')}
                          <span className="mx-2">•</span>
                          {movimento.metodo_pagamento}
                          {movimento.riferimento && (
                            <>
                              <span className="mx-2">•</span>
                              <Receipt className="h-3 w-3 mr-1" />
                              {movimento.riferimento}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`text-right font-medium ${
                      movimento.tipo === 'entrata' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movimento.tipo === 'entrata' ? '+' : '-'}
                      €{movimento.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessun movimento economico registrato</p>
              <p className="text-sm mt-2">Inizia aggiungendo il primo movimento con il pulsante sopra</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}