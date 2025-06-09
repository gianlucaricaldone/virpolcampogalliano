'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X, ChevronDown, ArrowUp } from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/' },
  { 
    name: 'Squadre', 
    href: '/squadre',
    submenu: [
      { name: 'Prima Squadra', href: '/squadre/prima-squadra' },
      { name: 'Juniores', href: '/squadre/juniores' },
      { name: 'Allievi', href: '/squadre/allievi' },
      { name: 'Giovanissimi', href: '/squadre/giovanissimi' },
      { name: 'Esordienti', href: '/squadre/esordienti' },
      { name: 'Scuola Calcio', href: '/squadre/scuola-calcio' },
    ]
  },
  { name: 'News', href: '/news' },
  { name: 'Tornei', href: '/tornei' },
  { name: 'Strutture', href: '/strutture' },
  { name: 'Contatti', href: '/contatti' },
]

export default function ModernHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10
      setScrolled(isScrolled)
      setShowBackToTop(window.scrollY > 500)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg' 
          : 'bg-transparent'
      }`}>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="relative h-10 w-10 transition-transform group-hover:scale-110">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-600 to-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">VC</span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className={`text-xl font-bold transition-colors ${
                    scrolled ? 'text-gray-900' : 'text-white'
                  }`}>
                    Virpol Campogalliano
                  </h1>
                  <p className={`text-xs transition-colors ${
                    scrolled ? 'text-gray-500' : 'text-gray-300'
                  }`}>
                    Società Sportiva
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:items-center lg:space-x-8">
              {navigation.map((item) => (
                <div key={item.name} className="relative">
                  {item.submenu ? (
                    <div
                      className="relative"
                      onMouseEnter={() => setDropdownOpen(item.name)}
                      onMouseLeave={() => setDropdownOpen(null)}
                    >
                      <button className={`flex items-center text-sm font-medium transition-colors hover:text-green-500 ${
                        scrolled ? 'text-gray-700' : 'text-white'
                      }`}>
                        {item.name}
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </button>
                      {dropdownOpen === item.name && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 opacity-0 animate-in fade-in duration-200">
                          <div className="py-2">
                            {item.submenu.map((subItem) => (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors rounded-lg mx-2"
                              >
                                {subItem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`text-sm font-medium transition-colors hover:text-green-500 ${
                        scrolled ? 'text-gray-700' : 'text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="hidden lg:flex lg:items-center lg:space-x-4">
              <Link href="/iscrizioni">
                <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all">
                  Iscriviti Ora
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant={scrolled ? "outline" : "ghost"} className={
                  scrolled 
                    ? "border-gray-300 text-gray-700 hover:bg-gray-50" 
                    : "text-white border-white hover:bg-white/10"
                }>
                  Area Riservata
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
                  scrolled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-white hover:bg-white/10'
                }`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="lg:hidden">
              <div className="space-y-1 bg-white/95 backdrop-blur-md rounded-xl mt-2 p-4 shadow-xl">
                {navigation.map((item) => (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                    {item.submenu && (
                      <div className="pl-6 space-y-1">
                        {item.submenu.map((subItem) => (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className="block px-3 py-2 text-sm text-gray-600 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-4 space-y-2">
                  <Link href="/iscrizioni" className="block">
                    <Button className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                      Iscriviti Ora
                    </Button>
                  </Link>
                  <Link href="/auth/login" className="block">
                    <Button variant="outline" className="w-full">
                      Area Riservata
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 animate-in fade-in slide-in-from-bottom-4"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  )
}