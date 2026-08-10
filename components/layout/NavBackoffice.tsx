'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { RuoloApp } from '@/lib/auth/session'
import { stagioneCorrenteDa } from '@/lib/domain/stagione'
import type { Stagione } from '@/lib/repos/stagioni'

/**
 * La barra è blu societario con il filetto giallo sotto, come il bordo dello
 * stemma. Le voci sono maiuscole spaziate: a bordo campo, col telefono in mano,
 * un'etichetta corta e maiuscola si becca con la coda dell'occhio meglio di una
 * minuscola più elegante.
 *
 * SU TELEFONO LE VOCI STANNO IN UN PANNELLO CHE SI APRE. Prima andavano a capo:
 * era il rimedio a un difetto peggiore — a 390px la riga unica era larga il
 * doppio del viewport e trascinava l'intera pagina in uno scroll orizzontale —
 * ma nove voci su tre righe si mangiavano centoventi pixel di altezza prima che
 * il contenuto cominciasse, cioè un quarto dello schermo speso in navigazione su
 * ogni schermata.
 *
 * Il pannello si chiude quando il percorso cambia. Il layout non si rimonta fra
 * una pagina e l'altra nell'App Router, quindi senza quell'effetto resterebbe
 * aperto sopra la pagina appena raggiunta.
 *
 * `Esci` resta sempre in barra, anche a pannello chiuso: è l'unica voce che si
 * cerca di fretta e che non deve costare due gesti.
 */
const VOCE_DESKTOP =
  'rounded-sm px-1 py-0.5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] ' +
  'text-white/85 decoration-2 underline-offset-[6px] transition-colors ' +
  'hover:text-white hover:underline hover:decoration-[var(--colore-giallo)]'

const VOCE_MOBILE =
  'flex min-h-11 items-center border-b border-white/15 px-4 text-sm font-semibold ' +
  'uppercase tracking-[0.08em] text-white/90 active:bg-white/10'

export function NavBackoffice({ ruolo, stagioni }: { ruolo: RuoloApp; stagioni: Stagione[] }) {
  const corrente = stagioneCorrenteDa(stagioni)
  const percorso = usePathname()
  const [aperto, setAperto] = useState(false)

  useEffect(() => setAperto(false), [percorso])

  // Un elenco solo, reso due volte: in riga sul desktop e in colonna nel
  // pannello. Duplicare le condizioni di ruolo in due punti è il modo di
  // ritrovarsi con un menù che offre le Quote all'allenatore su un solo schermo.
  const voci = [
    ...(corrente
      ? [
          { href: `/${corrente.codice}/squadre`, testo: 'Squadre' },
          { href: `/${corrente.codice}/tesseramenti`, testo: 'Tesserati' },
          { href: `/${corrente.codice}/presenze`, testo: 'Presenze' },
          { href: `/${corrente.codice}/statistiche`, testo: 'Statistiche' },
          // Nessuna voce Quote per l'allenatore: le due tabelle finanziarie non
          // hanno policy per lui, e la pagina lo rimanderebbe indietro.
          ...(ruolo !== 'allenatore'
            ? [{ href: `/${corrente.codice}/quote`, testo: 'Quote' }]
            : []),
        ]
      : []),
    { href: '/anagrafica', testo: 'Anagrafica' },
    ...(ruolo === 'admin'
      ? [
          { href: '/admin/stagioni', testo: 'Stagioni' },
          { href: '/admin/utenti', testo: 'Utenti' },
        ]
      : []),
  ]

  return (
    <header className="border-b-4 border-[var(--colore-giallo)] bg-[var(--colore-blu)]">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-4 py-3">
        <Link href="/gestione" className="flex items-center gap-2.5">
          {/* Lo stemma, non un titolo scritto: è il segno che la società usa
              davvero, e su una barra blu si stacca da sé. */}
          <Image
            src="/images/home/virpol-logo.png"
            alt="Virpol Campogalliano"
            width={30}
            height={30}
            className="h-[30px] w-[30px] object-contain"
          />
          <span className="font-[family-name:var(--font-archivo-black)] text-sm uppercase tracking-[0.14em] text-white">
            Virpol
          </span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
          {voci.map((v) => (
            <Link key={v.href} href={v.href} className={VOCE_DESKTOP}>{v.testo}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-sm border-2 border-[var(--colore-nero)] bg-[var(--colore-giallo)] px-2.5 py-1 font-[family-name:var(--font-archivo-black)] text-[0.6875rem] uppercase tracking-[0.09em] text-[var(--colore-nero)] hover:bg-[var(--colore-giallo-cupo)]"
            >
              Esci
            </button>
          </form>

          <button
            type="button"
            onClick={() => setAperto(!aperto)}
            aria-expanded={aperto}
            aria-controls="menu-backoffice"
            aria-label={aperto ? 'Chiudi il menù' : 'Apri il menù'}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border-2 border-white/40 text-white sm:hidden"
          >
            {/* Due tratti che diventano una croce: niente libreria di icone per
                tre righe di SVG. */}
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {aperto ? (
                <>
                  <path d="M4 4l12 12" />
                  <path d="M16 4L4 16" />
                </>
              ) : (
                <>
                  <path d="M3 6h14" />
                  <path d="M3 10h14" />
                  <path d="M3 14h14" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      <nav id="menu-backoffice" hidden={!aperto} className="border-t border-white/20 sm:hidden">
        {voci.map((v) => (
          <Link key={v.href} href={v.href} className={VOCE_MOBILE}>{v.testo}</Link>
        ))}
      </nav>
    </header>
  )
}
