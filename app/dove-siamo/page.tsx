import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { 
  MapPin, 
  Car, 
  Bus, 
  Train, 
  Clock, 
  Phone,
  Navigation,
  ParkingCircle,
  Coffee,
  Building
} from 'lucide-react'

export default function DoveSiamoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <MapPin className="h-16 w-16 mx-auto mb-6 text-green-300" />
            <h1 className="text-5xl font-bold mb-6">Dove Siamo</h1>
            <p className="text-xl text-green-100 max-w-3xl mx-auto">
              Il nostro centro sportivo si trova nel cuore di Campogalliano, 
              facilmente raggiungibile e dotato di tutti i servizi
            </p>
          </div>
        </section>

        {/* Indirizzo e Mappa */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-6">
                  Centro Sportivo <span className="text-blue-600">Virpol</span>
                </h2>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <MapPin className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">Indirizzo</h3>
                      <p className="text-gray-600">Via dello Sport, 1</p>
                      <p className="text-gray-600">41011 Campogalliano (MO)</p>
                      <p className="text-gray-600">Emilia-Romagna, Italia</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <Phone className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">Contatti</h3>
                      <p className="text-gray-600">Tel: 059 123456</p>
                      <p className="text-gray-600">Email: info@virpolcampogalliano.it</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <Clock className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">Orari Apertura</h3>
                      <div className="text-gray-600 space-y-1">
                        <p>Lunedì - Venerdì: 16:00 - 22:00</p>
                        <p>Sabato: 9:00 - 19:00</p>
                        <p>Domenica: 9:00 - 13:00 (solo partite)</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a 
                        href="https://maps.google.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button className="w-full">
                          <Navigation className="mr-2 h-4 w-4" />
                          Apri in Google Maps
                        </Button>
                      </a>
                      <a 
                        href="https://waze.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full">
                          <Car className="mr-2 h-4 w-4" />
                          Naviga con Waze
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                {/* Mappa placeholder - in produzione si userebbe Google Maps o OpenStreetMap */}
                <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Mappa Interattiva</p>
                    <p className="text-sm text-gray-400">Centro Sportivo Virpol</p>
                  </div>
                </div>
                {/* Overlay con coordinate */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-semibold text-gray-900">Coordinate GPS</p>
                  <p className="text-xs text-gray-600">44.7234°N, 10.8456°E</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Come Raggiungerci */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Come <span className="text-blue-600">Raggiungerci</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Diverse opzioni di trasporto per arrivare comodamente al nostro centro sportivo
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Car className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <CardTitle>In Auto</CardTitle>
                  <CardDescription>Il modo più comodo per raggiungerci</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Da Modena</h4>
                      <p className="text-sm text-gray-600">
                        Prendi la SS9 direzione Carpi, uscita Campogalliano Centro. 
                        Segui le indicazioni per il centro sportivo.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Da Carpi</h4>
                      <p className="text-sm text-gray-600">
                        Direzione Modena sulla SS9, uscita Campogalliano Centro. 
                        Il centro sportivo è a 2 km dall'uscita.
                      </p>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center text-sm text-green-600">
                        <ParkingCircle className="h-4 w-4 mr-2" />
                        Parcheggio gratuito disponibile
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Bus className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <CardTitle>Con i Mezzi Pubblici</CardTitle>
                  <CardDescription>Servizio autobus urbano ed extraurbano</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Linea 7 SETA</h4>
                      <p className="text-sm text-gray-600">
                        Da Modena Autostazione: fermata "Campogalliano Centro". 
                        Tempo di percorrenza: 25 minuti.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Linea 12 SETA</h4>
                      <p className="text-sm text-gray-600">
                        Da Carpi: fermata "Campogalliano Scuole". 
                        Tempo di percorrenza: 15 minuti.
                      </p>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        Dal centro del paese, il centro sportivo è raggiungibile a piedi in 8 minuti.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <Train className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <CardTitle>In Treno</CardTitle>
                  <CardDescription>Collegamento ferroviario regionale</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Stazione Campogalliano</h4>
                      <p className="text-sm text-gray-600">
                        Linea Modena-Mantova. La stazione dista 1,5 km dal centro sportivo.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Collegamenti</h4>
                      <p className="text-sm text-gray-600">
                        Da Modena: ogni 30 minuti (10 min di viaggio)<br />
                        Da Carpi: ogni ora (8 min di viaggio)
                      </p>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        Dalla stazione: autobus urbano o taxi disponibili.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Servizi e Strutture */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Servizi e <span className="text-green-600">Strutture</span>
              </h2>
              <p className="text-xl text-gray-600">
                Tutto quello che serve per un'esperienza sportiva completa
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <Image
                  src="https://images.unsplash.com/photo-1459865264687-595d652de67e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                  alt="Centro Sportivo Strutture"
                  width={600}
                  height={400}
                  className="rounded-lg object-cover"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MapPin className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">2 Campi Regolamentari</h3>
                  <p className="text-sm text-gray-600">Erba sintetica di ultima generazione</p>
                </div>

                <div className="text-center p-4">
                  <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ParkingCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Parcheggio Gratuito</h3>
                  <p className="text-sm text-gray-600">150 posti auto disponibili</p>
                </div>

                <div className="text-center p-4">
                  <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Coffee className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Bar e Ristoro</h3>
                  <p className="text-sm text-gray-600">Servizio completo di ristorazione</p>
                </div>

                <div className="text-center p-4">
                  <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Spogliatoi Moderni</h3>
                  <p className="text-sm text-gray-600">8 spogliatoi attrezzati</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-6">
              Vieni a Trovarci
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Il nostro centro sportivo ti aspetta. Vieni a vedere le nostre strutture 
              o partecipa a uno dei nostri eventi
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:059123456">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                  <Phone className="mr-2 h-5 w-5" />
                  Chiamaci Ora
                </Button>
              </a>
              <a 
                href="https://maps.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                  <Navigation className="mr-2 h-5 w-5" />
                  Indicazioni Stradali
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}