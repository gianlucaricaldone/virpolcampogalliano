import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Facebook, Instagram, Youtube } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo e Info Società */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative h-12 w-12">
                <Image
                  src="https://via.placeholder.com/48x48/2563eb/ffffff?text=VC"
                  alt="Virpol Campogalliano Logo"
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold">Virpol Campogalliano</h3>
                <p className="text-sm text-gray-400">Società Sportiva</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              Passione, dedizione e sport per tutta la famiglia. 
              Una realtà consolidata nel panorama calcistico locale.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-red-400 transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Utili */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Links Utili</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/squadre" className="text-gray-300 hover:text-white transition-colors">
                  Le Nostre Squadre
                </Link>
              </li>
              <li>
                <Link href="/tornei" className="text-gray-300 hover:text-white transition-colors">
                  Tornei ed Eventi
                </Link>
              </li>
              <li>
                <Link href="/news" className="text-gray-300 hover:text-white transition-colors">
                  News e Comunicazioni
                </Link>
              </li>
              <li>
                <Link href="/iscrizioni" className="text-gray-300 hover:text-white transition-colors">
                  Come Iscriversi
                </Link>
              </li>
              <li>
                <Link href="/regolamenti" className="text-gray-300 hover:text-white transition-colors">
                  Regolamenti
                </Link>
              </li>
            </ul>
          </div>

          {/* Squadre */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Le Squadre</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/squadre/scuola-calcio" className="text-gray-300 hover:text-white transition-colors">
                  Scuola Calcio
                </Link>
              </li>
              <li>
                <Link href="/squadre/giovanile" className="text-gray-300 hover:text-white transition-colors">
                  Settore Giovanile
                </Link>
              </li>
              <li>
                <Link href="/squadre/prima-squadra" className="text-gray-300 hover:text-white transition-colors">
                  Prima Squadra
                </Link>
              </li>
              <li>
                <Link href="/squadre/femminile" className="text-gray-300 hover:text-white transition-colors">
                  Calcio Femminile
                </Link>
              </li>
              <li>
                <Link href="/squadre/veterani" className="text-gray-300 hover:text-white transition-colors">
                  Veterani
                </Link>
              </li>
            </ul>
          </div>

          {/* Contatti */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contatti</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 text-sm">Via dello Sport, 1</p>
                  <p className="text-gray-300 text-sm">41011 Campogalliano (MO)</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-green-400 flex-shrink-0" />
                <p className="text-gray-300 text-sm">059 123456</p>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                <p className="text-gray-300 text-sm">info@virpolcampogalliano.it</p>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-400 mb-2">ORARI SEGRETERIA</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>Lunedì - Venerdì: 18:00 - 20:00</p>
                <p>Sabato: 15:00 - 18:00</p>
                <p>Domenica: Chiuso</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400">
              © 2024 Virpol Campogalliano. Tutti i diritti riservati.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/cookie" className="text-sm text-gray-400 hover:text-white transition-colors">
                Cookie Policy
              </Link>
              <Link href="/termini" className="text-sm text-gray-400 hover:text-white transition-colors">
                Termini di Servizio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}