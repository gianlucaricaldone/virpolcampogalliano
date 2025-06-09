import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { 
  Calendar, 
  MapPin, 
  Trophy, 
  Users, 
  Clock, 
  Euro,
  Star,
  Target,
  Award
} from 'lucide-react'

const torneiInCorso = [
  {
    id: 'primavera-u15',
    nome: 'Torneo Primavera U15',
    data: '15-16 Giugno 2024',
    categoria: 'Under 15',
    squadrePartecipanti: 16,
    costo: '150€',
    premio: '1000€ + Trofei',
    stato: 'Iscrizioni aperte',
    descrizione: 'Il torneo giovanile più atteso dell\'anno con squadre da tutta la regione.',
    immagine: 'https://images.unsplash.com/photo-1577223625816-7546f13df25d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    regolamento: 'Regolamento FIGC Under 15',
    location: 'Centro Sportivo Virpol',
    orari: '9:00 - 18:00'
  },
  {
    id: 'estate-calcio',
    nome: 'Festival del Calcio Estivo',
    data: '20-22 Luglio 2024',
    categoria: 'Multiple',
    squadrePartecipanti: 32,
    costo: '200€',
    premio: '2000€ + Coppe',
    stato: 'Sold out',
    descrizione: 'Tre giorni di calcio con multiple categorie e grande festa finale.',
    immagine: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    regolamento: 'Regolamento specifico per categoria',
    location: 'Centro Sportivo Virpol + Campi esterni',
    orari: '8:00 - 20:00'
  },
  {
    id: 'memorial-rossi',
    nome: 'Memorial Franco Rossi',
    data: '10-11 Agosto 2024',
    categoria: 'Prima Squadra',
    squadrePartecipanti: 8,
    costo: '300€',
    premio: '1500€ + Trofeo Memoriale',
    stato: 'Iscrizioni aperte',
    descrizione: 'Torneo dedicato alla memoria del nostro indimenticabile presidente.',
    immagine: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    regolamento: 'Regolamento FIGC Senior',
    location: 'Stadio Comunale Campogalliano',
    orari: '15:00 - 21:00'
  }
]

const torneiPassati = [
  {
    nome: 'Coppa della Pace 2024',
    vincitore: 'ASD Modena Est',
    partecipanti: 24,
    data: 'Maggio 2024'
  },
  {
    nome: 'Torneo Primavera U13',
    vincitore: 'Virpol Campogalliano',
    partecipanti: 12,
    data: 'Aprile 2024'
  },
  {
    nome: 'Memorial Baggio 2024',
    vincitore: 'Real Carpi',
    partecipanti: 16,
    data: 'Marzo 2024'
  }
]

export default function TorneiPage() {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Trophy className="h-16 w-16 mx-auto mb-6 text-yellow-300" />
            <h1 className="text-5xl font-bold mb-6">Tornei ed Eventi</h1>
            <p className="text-xl text-green-100 max-w-3xl mx-auto">
              Organizzamo tornei di prestigio che uniscono sport, competizione 
              e divertimento per tutte le età e categorie
            </p>
          </div>
        </section>

        {/* Prossimi Tornei */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Prossimi <span className="text-green-600">Tornei</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Non perdere i nostri eventi in programma. Iscriviti subito 
                o vieni a tifare per le tue squadre del cuore
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {torneiInCorso.map((torneo) => (
                <Card key={torneo.id} className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <Image
                      src={torneo.immagine}
                      alt={torneo.nome}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        torneo.stato === 'Iscrizioni aperte' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {torneo.stato}
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-xl font-bold">{torneo.nome}</h3>
                      <p className="text-sm opacity-90">{torneo.categoria}</p>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <p className="text-gray-600 mb-4">
                      {torneo.descrizione}
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-3 text-blue-500" />
                        {torneo.data}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-3 text-red-500" />
                        {torneo.location}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-3 text-purple-500" />
                        {torneo.orari}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-3 text-green-500" />
                        {torneo.squadrePartecipanti} squadre
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Euro className="h-4 w-4 mr-3 text-yellow-500" />
                        Iscrizione: {torneo.costo}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Award className="h-4 w-4 mr-3 text-yellow-600" />
                        Premio: {torneo.premio}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Link href={`/tornei/${torneo.id}`}>
                        <Button className="w-full">
                          Maggiori Informazioni
                        </Button>
                      </Link>
                      {torneo.stato === 'Iscrizioni aperte' && (
                        <Link href={`/tornei/${torneo.id}/iscrizione`}>
                          <Button variant="outline" className="w-full">
                            Iscriviti Ora
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Perché Partecipare */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Perché Partecipare ai Nostri <span className="text-blue-600">Tornei</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                I nostri eventi offrono molto più di semplici partite di calcio
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center p-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Competizione di Qualità</h3>
                <p className="text-gray-600">
                  Tornei organizzati secondo i migliori standard con arbitri qualificati
                </p>
              </div>

              <div className="text-center p-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Crescita Sportiva</h3>
                <p className="text-gray-600">
                  Opportunità di confronto con squadre di alto livello da tutta la regione
                </p>
              </div>

              <div className="text-center p-6">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Premi e Riconoscimenti</h3>
                <p className="text-gray-600">
                  Trofei personalizzati e premi in denaro per le squadre vincitrici
                </p>
              </div>

              <div className="text-center p-6">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Esperienza Completa</h3>
                <p className="text-gray-600">
                  Eventi con servizi completi: ristoro, parcheggio e intrattenimento
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tornei Passati */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                I Nostri <span className="text-green-600">Successi</span>
              </h2>
              <p className="text-xl text-gray-600">
                Alcuni dei tornei che abbiamo organizzato con successo
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {torneiPassati.map((torneo, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="text-center">
                    <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <CardTitle>{torneo.nome}</CardTitle>
                    <CardDescription>{torneo.data}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-green-600">
                        🏆 {torneo.vincitore}
                      </div>
                      <div className="text-sm text-gray-600">
                        {torneo.partecipanti} squadre partecipanti
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Organizza il tuo Torneo */}
        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-6">
              Organizza il Tuo Torneo con Noi
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Hai un'idea per un torneo? Collaboriamo con società, enti e sponsor 
              per creare eventi su misura
            </p>
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Strutture Moderne</h3>
                <p className="text-sm text-blue-100">Campi regolamentari e servizi completi</p>
              </div>
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Staff Esperto</h3>
                <p className="text-sm text-blue-100">Organizzazione professionale dell'evento</p>
              </div>
              <div className="text-center">
                <Trophy className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-semibold mb-2">Esperienza Pluriennale</h3>
                <p className="text-sm text-blue-100">Oltre 15 anni di eventi di successo</p>
              </div>
            </div>
            <Link href="/contatti">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                Contattaci per una Proposta
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}