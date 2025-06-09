import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Facebook, Instagram, Youtube, Heart } from 'lucide-react'

export default function ModernFooter() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M20 20c0 11.046-8.954 20-20 20s-20-8.954-20-20 8.954-20 20-20 20 8.954 20 20zm0-20c-11.046 0-20 8.954-20 20s8.954 20 20 20 20-8.954 20-20-8.954-20-20-20z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo e Info Società */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-600 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">VC</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                  Virpol Campogalliano
                </h3>
                <p className="text-sm text-gray-400">Società Sportiva</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Dal 2009 portiamo avanti la passione per il calcio con dedizione, 
              formazione e spirito di squadra. Una famiglia che cresce insieme.
            </p>
            <div className="flex space-x-4">
              <a 
                href="#" 
                className="group p-3 bg-gray-800 rounded-full hover:bg-blue-600 transition-all duration-300 hover:scale-110"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </a>
              <a 
                href="#" 
                className="group p-3 bg-gray-800 rounded-full hover:bg-pink-600 transition-all duration-300 hover:scale-110"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </a>
              <a 
                href="#" 
                className="group p-3 bg-gray-800 rounded-full hover:bg-red-600 transition-all duration-300 hover:scale-110"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </a>
            </div>
          </div>

          {/* Links Utili */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white">Navigation</h3>
            <ul className="space-y-3">
              {[
                { name: 'Le Nostre Squadre', href: '/squadre' },
                { name: 'News e Comunicazioni', href: '/news' },
                { name: 'Tornei ed Eventi', href: '/tornei' },
                { name: 'Strutture Sportive', href: '/strutture' },
                { name: 'Come Iscriversi', href: '/iscrizioni' },
                { name: 'Regolamenti', href: '/regolamenti' }
              ].map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href} 
                    className="text-gray-300 hover:text-green-400 transition-colors duration-200 text-sm flex items-center group"
                  >
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Squadre */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white">Le Squadre</h3>
            <ul className="space-y-3">
              {[
                { name: 'Prima Squadra', href: '/squadre/prima-squadra' },
                { name: 'Juniores', href: '/squadre/juniores' },
                { name: 'Allievi', href: '/squadre/allievi' },
                { name: 'Giovanissimi', href: '/squadre/giovanissimi' },
                { name: 'Esordienti', href: '/squadre/esordienti' },
                { name: 'Scuola Calcio', href: '/squadre/scuola-calcio' }
              ].map((squadra) => (
                <li key={squadra.name}>
                  <Link 
                    href={squadra.href} 
                    className="text-gray-300 hover:text-blue-400 transition-colors duration-200 text-sm flex items-center group"
                  >
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {squadra.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contatti */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white">Contatti</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 group">
                <MapPin className="h-5 w-5 text-green-400 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Via dello Sport, 1<br />
                    41011 Campogalliano (MO)<br />
                    Emilia-Romagna, Italia
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 group">
                <Phone className="h-5 w-5 text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <a href="tel:059123456" className="text-gray-300 text-sm hover:text-blue-400 transition-colors">
                  059 123456
                </a>
              </div>
              
              <div className="flex items-center space-x-3 group">
                <Mail className="h-5 w-5 text-yellow-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <a href="mailto:info@virpolcampogalliano.it" className="text-gray-300 text-sm hover:text-yellow-400 transition-colors break-all">
                  info@virpolcampogalliano.it
                </a>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Orari Segreteria</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Lun - Ven: 18:00 - 20:00</p>
                <p>Sabato: 15:00 - 18:00</p>
                <p>Domenica: Solo durante partite</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>© 2024 Virpol Campogalliano. Realizzato con</span>
              <Heart className="h-4 w-4 text-red-400 animate-pulse" />
              <span>per lo sport</span>
            </div>
            <div className="flex flex-wrap justify-center md:justify-end space-x-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/cookie" className="text-gray-400 hover:text-white transition-colors">
                Cookie Policy
              </Link>
              <Link href="/termini" className="text-gray-400 hover:text-white transition-colors">
                Termini di Servizio
              </Link>
              <Link href="/sitemap" className="text-gray-400 hover:text-white transition-colors">
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}