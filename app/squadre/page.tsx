import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Users, Trophy, Star, Calendar } from 'lucide-react'

const squadre = [
  {
    id: 'scuola-calcio',
    nome: 'Scuola Calcio',
    categoria: 'Piccoli Amici - Primi Calci',
    eta: '5-12 anni',
    descrizione: 'I primi passi nel mondo del calcio con divertimento e apprendimento delle basi tecniche.',
    immagine: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Marco Rossi',
    giorniAllenamento: ['Martedì', 'Giovedì'],
    orario: '17:00 - 18:30',
    obiettivi: ['Divertimento', 'Coordinazione motoria', 'Socializzazione', 'Prime tecniche di base']
  },
  {
    id: 'esordienti',
    nome: 'Esordienti',
    categoria: 'Under 13',
    eta: '11-13 anni',
    descrizione: 'Sviluppo delle competenze tecniche e prime nozioni tattiche di base.',
    immagine: 'https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Andrea Bianchi',
    giorniAllenamento: ['Lunedì', 'Mercoledì', 'Venerdì'],
    orario: '18:00 - 19:30',
    obiettivi: ['Tecnica individuale', 'Tattica di base', 'Fair play', 'Competizione sana']
  },
  {
    id: 'giovanissimi',
    nome: 'Giovanissimi',
    categoria: 'Under 15',
    eta: '13-15 anni',
    descrizione: 'Perfezionamento tecnico e sviluppo tattico per la crescita del giovane atleta.',
    immagine: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Luca Verdi',
    giorniAllenamento: ['Lunedì', 'Mercoledì', 'Venerdì'],
    orario: '19:00 - 20:30',
    obiettivi: ['Perfezionamento tecnico', 'Tattica avanzata', 'Preparazione atletica', 'Mentalità vincente']
  },
  {
    id: 'allievi',
    nome: 'Allievi',
    categoria: 'Under 17',
    eta: '15-17 anni',
    descrizione: 'Preparazione al calcio adulto con allenamenti mirati e competizioni importanti.',
    immagine: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Stefano Neri',
    giorniAllenamento: ['Lunedì', 'Mercoledì', 'Venerdì'],
    orario: '19:30 - 21:00',
    obiettivi: ['Calcio moderno', 'Preparazione fisica', 'Responsabilità', 'Leadership']
  },
  {
    id: 'juniores',
    nome: 'Juniores',
    categoria: 'Under 19',
    eta: '17-19 anni',
    descrizione: 'Il trampolino di lancio verso il calcio dei grandi con impegno e serietà.',
    immagine: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Roberto Blu',
    giorniAllenamento: ['Martedì', 'Giovedì', 'Sabato'],
    orario: '20:00 - 21:30',
    obiettivi: ['Professionalità', 'Mentalità da squadra', 'Preparazione completa', 'Ambizione']
  },
  {
    id: 'prima-squadra',
    nome: 'Prima Squadra',
    categoria: 'Terza Categoria',
    eta: '18+ anni',
    descrizione: 'Il fiore all\'occhiello della società, che rappresenta Campogalliano nei campionati regionali.',
    immagine: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Giuseppe Viola',
    giorniAllenamento: ['Martedì', 'Giovedì'],
    orario: '20:30 - 22:00',
    obiettivi: ['Competitività', 'Spirito di squadra', 'Rappresentanza territoriale', 'Crescita continua']
  },
  {
    id: 'femminile',
    nome: 'Calcio Femminile',
    categoria: 'Open',
    eta: '16+ anni',
    descrizione: 'La sezione femminile in crescita costante, simbolo di inclusività e passione.',
    immagine: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Sara Rosa',
    giorniAllenamento: ['Lunedì', 'Mercoledì'],
    orario: '19:00 - 20:30',
    obiettivi: ['Inclusività', 'Crescita movimento femminile', 'Tecnica raffinata', 'Orgoglio di appartenenza']
  },
  {
    id: 'veterani',
    nome: 'Veterani',
    categoria: 'Over 35',
    eta: '35+ anni',
    descrizione: 'Per chi non vuole smettere di giocare e mantenere viva la passione per il calcio.',
    immagine: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    allenatore: 'Franco Grigio',
    giorniAllenamento: ['Martedì', 'Giovedì'],
    orario: '21:00 - 22:30',
    obiettivi: ['Divertimento', 'Forma fisica', 'Amicizia', 'Passione eterna']
  }
]

export default function SquadrePage() {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl font-bold mb-6">Le Nostre Squadre</h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Dalla Scuola Calcio alla Prima Squadra, percorsi formativi completi 
              per ogni età e livello di preparazione
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="p-6">
                <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <div className="text-3xl font-bold text-gray-900 mb-2">8</div>
                <div className="text-gray-600">Squadre Attive</div>
              </div>
              <div className="p-6">
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <div className="text-3xl font-bold text-gray-900 mb-2">150+</div>
                <div className="text-gray-600">Atleti Tesserati</div>
              </div>
              <div className="p-6">
                <Star className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <div className="text-3xl font-bold text-gray-900 mb-2">12</div>
                <div className="text-gray-600">Allenatori Qualificati</div>
              </div>
              <div className="p-6">
                <Calendar className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                <div className="text-3xl font-bold text-gray-900 mb-2">25+</div>
                <div className="text-gray-600">Anni di Esperienza</div>
              </div>
            </div>
          </div>
        </section>

        {/* Squadre Grid */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Tutte le Nostre <span className="text-blue-600">Formazioni</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Ogni squadra ha il suo percorso specifico, con obiettivi mirati 
                e metodologie di allenamento appropriate per l'età e il livello
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {squadre.map((squadra) => (
                <Card key={squadra.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <Image
                      src={squadra.immagine}
                      alt={squadra.nome}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-xl font-bold">{squadra.nome}</h3>
                      <p className="text-sm opacity-90">{squadra.categoria}</p>
                    </div>
                    <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {squadra.eta}
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {squadra.descrizione}
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">Allenatore:</span>
                        <span className="text-gray-600">{squadra.allenatore}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">Allenamenti:</span>
                        <span className="text-gray-600">{squadra.giorniAllenamento.join(', ')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-gray-700">Orario:</span>
                        <span className="text-gray-600">{squadra.orario}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <h4 className="font-semibold text-gray-800 text-sm">Obiettivi principali:</h4>
                      <div className="flex flex-wrap gap-1">
                        {squadra.obiettivi.slice(0, 2).map((obiettivo, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {obiettivo}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Link href={`/squadre/${squadra.id}`}>
                      <Button className="w-full group-hover:bg-blue-700 transition-colors">
                        Scopri di più
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-6">
              Trova la Squadra Giusta per Te
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Non importa l'età o il livello, abbiamo la formazione perfetta 
              per iniziare o continuare il tuo percorso calcistico
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/iscrizioni">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                  Iscriviti Ora
                </Button>
              </Link>
              <Link href="/contatti">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                  Contattaci per Info
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}