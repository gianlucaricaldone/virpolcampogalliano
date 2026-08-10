import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SEDE } from '@/lib/costanti'

// Le quattro pagine del sito pubblico: home, squadre, contatti e dove-siamo.
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/squadre', label: 'Squadre' },
  { href: '/contatti', label: 'Contatti' },
  { href: '/dove-siamo', label: 'Dove Siamo' },
]

// Header e footer del sito vecchio (ModernHeader.tsx, ModernFooter.tsx)
// ricostruiti una volta sola qui: ogni pagina del gruppo (public) li eredita.
function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/home/virpol-logo.png"
            alt="Logo Virpol Campogalliano"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span>
            <span className="block text-lg font-bold text-neutral-900">
              Virpol Campogalliano
            </span>
            <span className="block text-xs text-neutral-500">Società Sportiva</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-neutral-700">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-blue-600">
              {label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
          >
            Accedi
          </Link>
        </nav>
      </div>
    </header>
  )
}

/*
 * Il footer aveva tre colonne e due erano da buttare: un telefono segnaposto
 * (059 123456), una email su dominio non verificato, e la colonna «Orari
 * Segreteria» — che dava orari diversi da quelli scritti in /contatti e in
 * /dove-siamo, tre versioni della stessa cosa in tre punti del sito. Restano
 * bio e indirizzo, che è vero e vive in SEDE, in un posto solo.
 *
 * Nessun anno nel copyright. C'era «© 2024» in un sito che gira nel 2026, e le
 * due alternative hanno lo stesso difetto in tempi diversi: un anno scritto a
 * mano invecchia, `new Date().getFullYear()` in una pagina prerenderizzata si
 * congela al momento del build. Non scriverlo è la sola forma che non scade.
 */
function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-white">Virpol Campogalliano</h2>
          <p className="mt-1 text-sm text-neutral-400">Società Sportiva</p>
          <p className="mt-4 text-sm leading-relaxed">
            Portiamo avanti la passione per il calcio con dedizione, formazione e
            spirito di squadra. Una famiglia che cresce insieme.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Dove siamo</h3>
          <address className="mt-4 text-sm not-italic leading-relaxed">
            <span className="block text-neutral-200">{SEDE.centro}</span>
            {SEDE.via}
            <br />
            {SEDE.comune}
          </address>
          <Link href="/dove-siamo" className="mt-4 inline-block text-sm hover:text-white">
            Come arrivare →
          </Link>
        </div>
      </div>

      <div className="border-t border-neutral-700 px-4 py-6 text-center text-sm text-neutral-500">
        © Virpol Campogalliano. Realizzato con ♥ per lo sport.
      </div>
    </footer>
  )
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
