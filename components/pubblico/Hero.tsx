import Image from 'next/image'
import Link from 'next/link'

// Porta dal vecchio app/page.tsx (righe 91-161) la sezione hero: sfondo,
// logo, titolo, sottotitolo e i due bottoni. Cade il parallasse via JS
// (ParallaxSection), `animate-pulse` sul titolo e lo scroll indicator
// animato: qui il fondo è fisso e la pagina non ha stato client.
//
// «Iscriviti Ora» puntava a /iscrizioni nel sito vecchio, pagina fuori
// perimetro nel piano nuovo (solo /, /squadre, /contatti, /dove-siamo):
// il testo del bottone resta identico, la destinazione è /contatti, l'unica
// pagina in ambito per un'iscrizione.
export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
      <Image
        src="/images/home/hero-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative mx-auto max-w-5xl px-4 py-24 text-center text-white">
        <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-r from-yellow-400 to-blue-600 shadow-2xl">
          <Image
            src="/images/home/virpol-logo.png"
            alt="Logo Virpol Campogalliano"
            width={100}
            height={100}
            className="object-contain"
          />
        </div>

        <h1 className="mb-4 text-6xl font-bold md:text-8xl">Virpol</h1>
        <h2 className="mb-8 text-4xl font-bold md:text-6xl">Campogalliano</h2>

        <p className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-neutral-200 md:text-2xl">
          Dove la passione per il calcio diventa{' '}
          <span className="font-semibold text-yellow-400">famiglia</span>.
          Formazione, crescita e successi dal 2009.
        </p>

        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
          <Link
            href="/contatti"
            className="rounded-full bg-gradient-to-r from-yellow-400 to-blue-600 px-10 py-4 text-lg font-semibold shadow-2xl transition hover:from-yellow-500 hover:to-blue-700"
          >
            Iscriviti Ora
          </Link>
          <Link
            href="#chi-siamo"
            className="rounded-full border-2 border-white px-10 py-4 text-lg font-semibold transition hover:bg-white hover:text-neutral-900"
          >
            Scopri di Più
          </Link>
        </div>
      </div>
    </section>
  )
}
