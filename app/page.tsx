'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ModernHeader from '@/components/layout/ModernHeader'
import ModernFooter from '@/components/layout/ModernFooter'
import AnimatedSection from '@/components/ui/AnimatedSection'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import ParallaxSection from '@/components/ui/ParallaxSection'
import { useSquadre } from '@/hooks/useSquadre'
import { useTorneiAttivi, useNews } from '@/hooks/useTornei'
import { useStats } from '@/hooks/useStats'
import { 
  Trophy, 
  Users, 
  Calendar, 
  Star, 
  MapPin, 
  Phone,
  Mail,
  ArrowRight,
  PlayCircle,
  Award,
  Target,
  Heart,
  ChevronDown,
  Zap,
  Shield,
  Sparkles,
  Medal,
  Timer,
  Globe,
  Loader2,
  UserCheck
} from 'lucide-react'

// Colori per le squadre basati sull'indice
const coloriSquadre = [
  'from-red-500 to-red-700',
  'from-blue-500 to-blue-700',
  'from-green-500 to-green-700',
  'from-purple-500 to-purple-700',
  'from-yellow-500 to-orange-600',
  'from-pink-500 to-pink-700',
  'from-indigo-500 to-indigo-700',
  'from-teal-500 to-teal-700'
]

// Descrizioni per le squadre
const descrizioniSquadre: { [key: string]: string } = {
  'Prima Squadra': 'L\'elite del calcio locale che rappresenta i valori della società',
  'Juniores': 'Il trampolino verso il calcio professionistico',
  'Allievi': 'Formazione tecnica e tattica avanzata',
  'Giovanissimi': 'Sviluppo delle competenze e spirito di squadra',
  'Esordienti': 'Le basi tecniche con divertimento e passione',
  'Scuola Calcio': 'I primi passi nel mondo del calcio',
  'Under 19': 'Il trampolino verso il calcio professionistico',
  'Under 17': 'Formazione tecnica e tattica avanzata',
  'Under 15': 'Sviluppo delle competenze e spirito di squadra',
  'Under 13': 'Le basi tecniche con divertimento e passione',
  'Piccoli Amici': 'I primi passi nel mondo del calcio'
}

export default function ModernHomePage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const { squadre, loading: squadreLoading } = useSquadre()
  const { tornei, loading: torneiLoading } = useTorneiAttivi()
  const { news, loading: newsLoading } = useNews()
  const { stats, loading: statsLoading } = useStats()

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <ModernHeader />
      
      <main>
        {/* Hero Section */}
        <ParallaxSection
          backgroundImage="https://images.unsplash.com/photo-1574629810360-7efbbe195018?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
          className="relative h-screen flex items-center justify-center"
          overlay={true}
          overlayOpacity={0.5}
        >
          <div className="text-center text-white max-w-5xl mx-auto px-4">
            <AnimatedSection 
              animation="fade-in" 
              className={`transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            >
              {/* Logo animato */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-green-600 to-blue-600 shadow-2xl transform hover:scale-110 transition-transform duration-300">
                  <span className="text-white font-bold text-3xl">VC</span>
                </div>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-white via-green-200 to-blue-200 bg-clip-text text-transparent animate-pulse">
                Virpol
              </h1>
              <h2 className="text-4xl md:text-6xl font-bold mb-8 text-white">
                Campogalliano
              </h2>
              
              <p className="text-xl md:text-2xl mb-12 text-gray-200 max-w-3xl mx-auto leading-relaxed">
                Dove la passione per il calcio diventa <span className="text-green-400 font-semibold">famiglia</span>. 
                Formazione, crescita e successi dal 2009.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
                <Link href="/iscrizioni">
                  <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-lg px-10 py-4 rounded-full shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 transition-all duration-300 border-0">
                    <Sparkles className="mr-2 h-6 w-6" />
                    Iscriviti Ora
                  </Button>
                </Link>
                <Link href="#chi-siamo">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="text-lg px-10 py-4 rounded-full border-2 border-white text-white hover:bg-white hover:text-gray-900 transition-all duration-300 backdrop-blur-sm"
                    onClick={() => scrollToSection('chi-siamo')}
                  >
                    <PlayCircle className="mr-2 h-6 w-6" />
                    Scopri di Più
                  </Button>
                </Link>
              </div>
            </AnimatedSection>
          </div>
          
          {/* Scroll indicator animato */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <button 
              onClick={() => scrollToSection('stats')}
              className="flex flex-col items-center animate-bounce hover:scale-110 transition-transform cursor-pointer"
            >
              <div className="w-8 h-12 border-2 border-white rounded-full flex justify-center mb-2">
                <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
              </div>
              <ChevronDown className="h-6 w-6 text-white" />
            </button>
          </div>
        </ParallaxSection>

        {/* Stats Section */}
        <section id="stats" className="py-20 bg-gradient-to-r from-green-600 to-blue-600 text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection animation="fade-in" className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">I Nostri Numeri</h2>
              <p className="text-xl text-green-100">Una storia di successi e crescita costante</p>
            </AnimatedSection>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <AnimatedSection animation="scale-in" delay={100}>
                <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
                  <div className="text-4xl font-bold mb-2">
                    {statsLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    ) : (
                      <AnimatedCounter end={stats.anni_storia} suffix="+" />
                    )}
                  </div>
                  <div className="text-green-100">Anni di Storia</div>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="scale-in" delay={200}>
                <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <Users className="h-12 w-12 mx-auto mb-4 text-blue-300" />
                  <div className="text-4xl font-bold mb-2">
                    {statsLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    ) : (
                      <AnimatedCounter end={stats.squadre_attive} />
                    )}
                  </div>
                  <div className="text-blue-100">Squadre Attive</div>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="scale-in" delay={300}>
                <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <Star className="h-12 w-12 mx-auto mb-4 text-purple-300" />
                  <div className="text-4xl font-bold mb-2">
                    {statsLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    ) : (
                      <AnimatedCounter end={stats.atleti_tesserati} suffix="+" />
                    )}
                  </div>
                  <div className="text-purple-100">Atleti Tesserati</div>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="scale-in" delay={400}>
                <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <Medal className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
                  <div className="text-4xl font-bold mb-2">
                    {statsLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    ) : (
                      <AnimatedCounter end={stats.trofei_vinti} suffix="+" />
                    )}
                  </div>
                  <div className="text-yellow-100">Trofei Vinti</div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Chi Siamo Section */}
        <section id="chi-siamo" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <AnimatedSection animation="slide-in-left">
                <div>
                  <h2 className="text-5xl font-bold text-gray-900 mb-6">
                    La Nostra <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Storia</span>
                  </h2>
                  <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                    Dal 2009, la <strong>Virpol Campogalliano</strong> rappresenta un punto di riferimento 
                    nel panorama calcistico locale. Nata dalla passione di un gruppo di 
                    amici, oggi è cresciuta fino a diventare una vera e propria famiglia.
                  </p>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    La nostra missione è quella di far crescere i giovani atleti non solo 
                    dal punto di vista tecnico, ma anche umano, trasmettendo i valori 
                    dello sport e del rispetto reciproco.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-4 rounded-xl bg-red-50 hover:bg-red-100 transition-colors">
                      <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <div className="font-semibold text-gray-900">Passione</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors">
                      <Target className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <div className="font-semibold text-gray-900">Formazione</div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-yellow-50 hover:bg-yellow-100 transition-colors">
                      <Award className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <div className="font-semibold text-gray-900">Eccellenza</div>
                    </div>
                  </div>
                  
                  <Link href="/storia">
                    <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-lg px-8 py-3 rounded-full">
                      Scopri di più
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </AnimatedSection>

              <AnimatedSection animation="slide-in-right">
                <div className="relative">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="relative overflow-hidden rounded-2xl transform hover:scale-105 transition-transform duration-300">
                        <Image
                          src="https://images.unsplash.com/photo-1577223625816-7546f13df25d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                          alt="Squadra celebra"
                          width={300}
                          height={200}
                          className="object-cover w-full h-48"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl transform hover:scale-105 transition-transform duration-300">
                        <Image
                          src="https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                          alt="Allenamento"
                          width={300}
                          height={200}
                          className="object-cover w-full h-48"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                      </div>
                    </div>
                    <div className="space-y-4 pt-8">
                      <div className="relative overflow-hidden rounded-2xl transform hover:scale-105 transition-transform duration-300">
                        <Image
                          src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                          alt="Giovani calciatori"
                          width={300}
                          height={200}
                          className="object-cover w-full h-48"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                      </div>
                      <div className="relative overflow-hidden rounded-2xl transform hover:scale-105 transition-transform duration-300">
                        <Image
                          src="https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                          alt="Tifosi"
                          width={300}
                          height={200}
                          className="object-cover w-full h-48"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Elemento decorativo */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-green-400 to-blue-400 rounded-full opacity-20 animate-pulse"></div>
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 animate-pulse delay-1000"></div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Squadre Section */}
        <section className="py-24 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection animation="fade-in" className="text-center mb-16">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">
                Le Nostre <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Squadre</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Dalla Scuola Calcio alla Prima Squadra, offriamo percorsi formativi 
                completi per ogni età e livello di preparazione
              </p>
            </AnimatedSection>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {squadreLoading ? (
                <div className="col-span-full flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Caricamento squadre...</span>
                </div>
              ) : (
                squadre.slice(0, 6).map((squadra, index) => (
                  <AnimatedSection
                    key={squadra.id}
                    animation="slide-in-up"
                    delay={index * 150}
                  >
                    <Card className="group overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:rotate-1 border-0">
                      <div className="relative h-64 overflow-hidden">
                        <Image
                          src={squadra.foto_squadra || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                          alt={squadra.nome}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className={`absolute inset-0 bg-gradient-to-t ${coloriSquadre[index % coloriSquadre.length]} opacity-80`}></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                        
                        {/* Badge categoria */}
                        <div className="absolute top-4 right-4">
                          <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
                            {squadra.categoria}
                          </span>
                        </div>
                        
                        {/* Titolo */}
                        <div className="absolute bottom-4 left-4 text-white">
                          <h3 className="text-2xl font-bold mb-1">{squadra.nome}</h3>
                          <div className="flex items-center space-x-2">
                            <Shield className="h-4 w-4" />
                            <span className="text-sm opacity-90">{squadra.categoria}</span>
                          </div>
                        </div>
                      </div>
                      
                      <CardContent className="p-6">
                        <p className="text-gray-600 mb-6 leading-relaxed">
                          {descrizioniSquadre[squadra.nome] || 'Una squadra dedicata alla formazione e alla crescita dei nostri atleti.'}
                        </p>
                        
                        <Link href={`/squadre/${squadra.id}`}>
                          <Button className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-xl group-hover:shadow-lg transition-all">
                            Scopri di più
                            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                ))
              )}
            </div>

            <AnimatedSection animation="fade-in" delay={800} className="text-center mt-12">
              <Link href="/squadre">
                <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-lg px-12 py-4 rounded-full shadow-xl">
                  Vedi Tutte le Squadre
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </Link>
            </AnimatedSection>
          </div>
        </section>

        {/* Tornei Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection animation="fade-in" className="text-center mb-16">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">
                I Nostri <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Tornei</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Organizziamo tornei di calcio per tutte le categorie. Scopri gli eventi in programma e le iscrizioni aperte.
              </p>
            </AnimatedSection>

            {torneiLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Caricamento tornei...</span>
              </div>
            ) : tornei.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tornei.map((torneo, index) => (
                  <AnimatedSection
                    key={torneo.id}
                    animation="slide-in-up"
                    delay={index * 150}
                  >
                    <Card className="group overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border-0">
                      <div className="relative h-48 overflow-hidden">
                        <Image
                          src={torneo.immagine_copertina || 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'}
                          alt={torneo.nome}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        
                        {/* Badge iscrizioni */}
                        <div className="absolute top-4 right-4">
                          {torneo.iscrizioni_aperte ? (
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Iscrizioni Aperte
                            </span>
                          ) : (
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              Iscrizioni Chiuse
                            </span>
                          )}
                        </div>
                        
                        {/* Titolo e date */}
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                          <h3 className="text-xl font-bold mb-2">{torneo.nome}</h3>
                          <div className="flex items-center space-x-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(torneo.data_inizio).toLocaleDateString('it-IT')} - {new Date(torneo.data_fine).toLocaleDateString('it-IT')}
                            </span>
                          </div>
                          {torneo.luogo && (
                            <div className="flex items-center space-x-2 text-sm mt-1">
                              <MapPin className="h-4 w-4" />
                              <span>{torneo.luogo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {torneo.descrizione && (
                            <p className="text-gray-600 leading-relaxed line-clamp-2">
                              {torneo.descrizione}
                            </p>
                          )}
                          
                          {/* Info squadre e costo */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {torneo.numero_squadre_max && (
                              <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-center mb-1">
                                  <Users className="h-4 w-4 text-blue-600 mr-1" />
                                  <span className="font-semibold text-blue-600">
                                    {torneo.numero_squadre_iscritte || 0}/{torneo.numero_squadre_max}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">Squadre</div>
                              </div>
                            )}
                            
                            {torneo.costo_iscrizione && (
                              <div className="text-center p-3 bg-green-50 rounded-lg">
                                <div className="font-semibold text-green-600 mb-1">
                                  €{torneo.costo_iscrizione}
                                </div>
                                <div className="text-xs text-gray-600">Iscrizione</div>
                              </div>
                            )}
                          </div>
                          
                          {/* Contatti */}
                          {(torneo.contatto_email || torneo.contatto_telefono) && (
                            <div className="border-t pt-4 space-y-2">
                              {torneo.contatto_email && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Mail className="h-4 w-4 mr-2" />
                                  <a href={`mailto:${torneo.contatto_email}`} className="hover:text-blue-600">
                                    {torneo.contatto_email}
                                  </a>
                                </div>
                              )}
                              {torneo.contatto_telefono && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Phone className="h-4 w-4 mr-2" />
                                  <a href={`tel:${torneo.contatto_telefono}`} className="hover:text-blue-600">
                                    {torneo.contatto_telefono}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-6">
                          {torneo.iscrizioni_aperte ? (
                            <Button className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-xl">
                              <Trophy className="mr-2 h-4 w-4" />
                              Iscriviti al Torneo
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full rounded-xl">
                              <Trophy className="mr-2 h-4 w-4" />
                              Scopri di più
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nessun torneo attivo al momento.</p>
                <p className="text-sm text-gray-500 mt-2">Torna presto per scoprire i prossimi eventi!</p>
              </div>
            )}

            {tornei.length > 0 && (
              <AnimatedSection animation="fade-in" delay={600} className="text-center mt-12">
                <Link href="/tornei">
                  <Button size="lg" variant="outline" className="text-lg px-12 py-4 rounded-full border-2 hover:bg-gradient-to-r hover:from-green-600 hover:to-blue-600 hover:text-white hover:border-transparent transition-all">
                    Vedi Tutti i Tornei
                    <ArrowRight className="ml-2 h-6 w-6" />
                  </Button>
                </Link>
              </AnimatedSection>
            )}
          </div>
        </section>

        {/* News Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimatedSection animation="fade-in" className="text-center mb-16">
              <h2 className="text-5xl font-bold text-gray-900 mb-6">
                News & <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Eventi</span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Rimani sempre aggiornato sulle ultime novità e gli eventi della nostra società
              </p>
            </AnimatedSection>

            {newsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Caricamento news...</span>
              </div>
            ) : news.length > 0 ? (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Featured News */}
                <AnimatedSection animation="slide-in-left" className="lg:col-span-2">
                  <Card className="group overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 border-0 h-full">
                    <div className="relative h-64 lg:h-80 overflow-hidden">
                      <Image
                        src={news[0].immagine}
                        alt={news[0].titolo}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                      
                      <div className="absolute top-4 left-4">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          In Evidenza
                        </span>
                      </div>
                      
                      <div className="absolute bottom-6 left-6 right-6 text-white">
                        <div className="flex items-center space-x-2 mb-3">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm opacity-90">{news[0].data}</span>
                          <span className="text-sm opacity-70">•</span>
                          <span className="text-sm opacity-90">{news[0].categoria}</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">{news[0].titolo}</h3>
                        <p className="text-gray-200 leading-relaxed">{news[0].excerpt}</p>
                      </div>
                    </div>
                  </Card>
                </AnimatedSection>

                {/* Side News */}
                <div className="space-y-6">
                  {news.slice(1).map((newsItem, index) => (
                    <AnimatedSection
                      key={newsItem.id}
                      animation="slide-in-right"
                      delay={index * 200}
                    >
                      <Card className="group overflow-hidden bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-0">
                        <div className="flex">
                          <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden">
                            <Image
                              src={newsItem.immagine}
                              alt={newsItem.titolo}
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          </div>
                          <div className="p-4 flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-xs text-gray-500">{newsItem.data}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-blue-600 font-medium">{newsItem.categoria}</span>
                            </div>
                            <h4 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {newsItem.titolo}
                            </h4>
                            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                              {newsItem.excerpt}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </AnimatedSection>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Nessuna news disponibile al momento.</p>
              </div>
            )}

            <AnimatedSection animation="fade-in" delay={600} className="text-center mt-12">
              <Link href="/news">
                <Button size="lg" variant="outline" className="text-lg px-12 py-4 rounded-full border-2 hover:bg-gradient-to-r hover:from-green-600 hover:to-blue-600 hover:text-white hover:border-transparent transition-all">
                  Vedi Tutte le News
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Button>
              </Link>
            </AnimatedSection>
          </div>
        </section>

        {/* Strutture Section */}
        <ParallaxSection
          backgroundImage="https://images.unsplash.com/photo-1459865264687-595d652de67e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
          className="py-24"
          overlayOpacity={0.7}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <AnimatedSection animation="slide-in-left">
                <div>
                  <h2 className="text-5xl font-bold mb-6">
                    Le Nostre <span className="text-green-400">Strutture</span>
                  </h2>
                  <p className="text-xl mb-8 text-gray-200 leading-relaxed">
                    Il nostro centro sportivo offre impianti moderni e attrezzature 
                    all'avanguardia per garantire la migliore esperienza sportiva 
                    a tutti i nostri atleti.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="flex items-center space-x-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                      <Zap className="h-8 w-8 text-yellow-400 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">2 Campi</div>
                        <div className="text-sm text-gray-300">Erba sintetica</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                      <Shield className="h-8 w-8 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">Illuminazione</div>
                        <div className="text-sm text-gray-300">LED professionale</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                      <Users className="h-8 w-8 text-green-400 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">8 Spogliatoi</div>
                        <div className="text-sm text-gray-300">Moderni e attrezzati</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                      <Globe className="h-8 w-8 text-purple-400 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">Bar & Ristoro</div>
                        <div className="text-sm text-gray-300">Servizio completo</div>
                      </div>
                    </div>
                  </div>

                  <Link href="/strutture">
                    <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 text-lg px-8 py-3 rounded-full shadow-xl">
                      <MapPin className="mr-2 h-5 w-5" />
                      Esplora le Strutture
                    </Button>
                  </Link>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </ParallaxSection>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white relative overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-48 -translate-y-48 animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-48 translate-y-48 animate-pulse delay-1000"></div>
          </div>
          
          <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <AnimatedSection animation="scale-in">
              <Sparkles className="h-16 w-16 mx-auto mb-6 text-yellow-300" />
              <h2 className="text-5xl font-bold mb-6">
                Unisciti alla Famiglia Virpol
              </h2>
              <p className="text-xl mb-12 text-blue-100 max-w-2xl mx-auto leading-relaxed">
                Scopri come diventare parte della nostra comunità sportiva. 
                Le iscrizioni per la nuova stagione sono aperte!
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link href="/iscrizioni">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-12 py-4 rounded-full shadow-2xl transform hover:scale-105 transition-all">
                    <Heart className="mr-2 h-6 w-6" />
                    Iscriviti Ora
                  </Button>
                </Link>
                <Link href="/contatti">
                  <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-blue-600 text-lg px-12 py-4 rounded-full backdrop-blur-sm">
                    <Phone className="mr-2 h-6 w-6" />
                    Contattaci
                  </Button>
                </Link>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>

      <ModernFooter />
    </div>
  )
}