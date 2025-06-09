'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send,
  User,
  MessageSquare,
  Calendar,
  Facebook,
  Instagram,
  Youtube
} from 'lucide-react'

const contatti = [
  {
    nome: 'Segreteria Generale',
    ruolo: 'Informazioni e Iscrizioni',
    telefono: '059 123456',
    email: 'info@virpolcampogalliano.it',
    orari: 'Lun-Ven 18:00-20:00, Sab 15:00-18:00',
    icon: User
  },
  {
    nome: 'Responsabile Scuola Calcio',
    ruolo: 'Marco Rossi',
    telefono: '347 1234567',
    email: 'scuolacalcio@virpolcampogalliano.it',
    orari: 'Disponibile durante allenamenti',
    icon: MessageSquare
  },
  {
    nome: 'Settore Giovanile',
    ruolo: 'Andrea Bianchi',
    telefono: '335 9876543',
    email: 'giovanile@virpolcampogalliano.it',
    orari: 'Mar-Gio 19:00-20:00',
    icon: Calendar
  },
  {
    nome: 'Prima Squadra',
    ruolo: 'Giuseppe Viola',
    telefono: '328 5551234',
    email: 'primasquadra@virpolcampogalliano.it',
    orari: 'Su appuntamento',
    icon: Phone
  }
]

export default function ContattiPage() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefono: '',
    argomento: '',
    messaggio: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // Simula invio form
    setTimeout(() => {
      setMessage('Messaggio inviato con successo! Ti ricontatteremo presto.')
      setFormData({
        nome: '',
        email: '',
        telefono: '',
        argomento: '',
        messaggio: ''
      })
      setLoading(false)
    }, 1000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-r from-blue-600 to-green-600 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Mail className="h-16 w-16 mx-auto mb-6 text-blue-300" />
            <h1 className="text-5xl font-bold mb-6">Contattaci</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Siamo sempre disponibili per rispondere alle tue domande e aiutarti 
              a trovare la soluzione migliore per le tue esigenze sportive
            </p>
          </div>
        </section>

        {/* Informazioni di Contatto */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Le Nostre <span className="text-blue-600">Informazioni</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Contatta direttamente il reparto di tuo interesse per ricevere 
                informazioni specifiche e dettagliate
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              {contatti.map((contatto, index) => {
                const Icon = contatto.icon
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow text-center">
                    <CardHeader>
                      <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon className="h-8 w-8 text-blue-600" />
                      </div>
                      <CardTitle className="text-lg">{contatto.nome}</CardTitle>
                      <CardDescription>{contatto.ruolo}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-green-500" />
                        <a href={`tel:${contatto.telefono.replace(/\s/g, '')}`} className="hover:text-blue-600">
                          {contatto.telefono}
                        </a>
                      </div>
                      <div className="flex items-center justify-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-blue-500" />
                        <a href={`mailto:${contatto.email}`} className="hover:text-blue-600 break-all">
                          {contatto.email}
                        </a>
                      </div>
                      <div className="flex items-center justify-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-2" />
                        {contatto.orari}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Informazioni Principali */}
            <div className="grid lg:grid-cols-3 gap-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <MapPin className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <CardTitle>Indirizzo</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <p className="font-semibold text-gray-900">Centro Sportivo Virpol</p>
                  <p className="text-gray-600">Via dello Sport, 1</p>
                  <p className="text-gray-600">41011 Campogalliano (MO)</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <MapPin className="mr-2 h-4 w-4" />
                    Indicazioni
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Clock className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                  <CardTitle>Orari Segreteria</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <div className="space-y-1 text-gray-600">
                    <p><span className="font-semibold">Lun-Ven:</span> 18:00 - 20:00</p>
                    <p><span className="font-semibold">Sabato:</span> 15:00 - 18:00</p>
                    <p><span className="font-semibold">Domenica:</span> Chiuso</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Durante le partite domenicali siamo disponibili presso il campo
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Phone className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <CardTitle>Emergenze</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <p className="text-gray-600">Per urgenze durante allenamenti o partite:</p>
                  <p className="font-semibold text-lg text-gray-900">333 1234567</p>
                  <p className="text-sm text-gray-500">
                    Disponibile solo per emergenze mediche o situazioni urgenti
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Form di Contatto */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Invia un <span className="text-blue-600">Messaggio</span>
              </h2>
              <p className="text-xl text-gray-600">
                Compila il form per ricevere informazioni dettagliate o per richiedere un appuntamento
              </p>
            </div>

            <Card className="shadow-lg">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        id="nome"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Il tuo nome e cognome"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="la-tua@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                        Telefono
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Il tuo numero di telefono"
                      />
                    </div>
                    <div>
                      <label htmlFor="argomento" className="block text-sm font-medium text-gray-700 mb-2">
                        Argomento *
                      </label>
                      <select
                        id="argomento"
                        name="argomento"
                        value={formData.argomento}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Seleziona un argomento</option>
                        <option value="iscrizione">Iscrizione nuova squadra</option>
                        <option value="informazioni">Informazioni generali</option>
                        <option value="tornei">Tornei ed eventi</option>
                        <option value="sponsorizzazioni">Sponsorizzazioni</option>
                        <option value="collaborazioni">Collaborazioni</option>
                        <option value="reclami">Reclami e segnalazioni</option>
                        <option value="altro">Altro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="messaggio" className="block text-sm font-medium text-gray-700 mb-2">
                      Messaggio *
                    </label>
                    <textarea
                      id="messaggio"
                      name="messaggio"
                      value={formData.messaggio}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Scrivi qui il tuo messaggio dettagliato..."
                    />
                  </div>

                  <div className="text-center">
                    <Button
                      type="submit"
                      disabled={loading}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 px-8"
                    >
                      {loading ? (
                        'Invio in corso...'
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Invia Messaggio
                        </>
                      )}
                    </Button>
                  </div>

                  {message && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md text-center">
                      <p className="text-green-700">{message}</p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Social Media */}
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Seguici sui <span className="text-blue-600">Social</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Resta sempre aggiornato su news, risultati e eventi della Virpol Campogalliano
            </p>
            
            <div className="flex justify-center space-x-6">
              <a 
                href="#" 
                className="bg-blue-600 text-white p-4 rounded-full hover:bg-blue-700 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-6 w-6" />
              </a>
              <a 
                href="#" 
                className="bg-pink-600 text-white p-4 rounded-full hover:bg-pink-700 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-6 w-6" />
              </a>
              <a 
                href="#" 
                className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="h-6 w-6" />
              </a>
            </div>

            <div className="mt-8 text-sm text-gray-500">
              <p>Rispondiamo ai messaggi sui social entro 24 ore</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}