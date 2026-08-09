import Image from 'next/image'
import Link from 'next/link'
import type { RuoloApp } from '@/lib/auth/session'
import { stagioneCorrenteDa } from '@/lib/domain/stagione'
import type { Stagione } from '@/lib/repos/stagioni'

/**
 * La barra è blu societario con il filetto giallo sotto, come il bordo dello
 * stemma. Le voci sono maiuscole spaziate: a bordo campo, col telefono in mano,
 * un'etichetta corta e maiuscola si becca con la coda dell'occhio meglio di una
 * minuscola più elegante.
 *
 * Il giallo marca solo il passaggio del dito o del cursore — un sottolineato
 * pieno che compare. Non c'è nessuna voce "attiva" evidenziata: il titolo della
 * pagina lo dice già, e due indicatori per lo stesso fatto litigano.
 */
const VOCE =
  'rounded-sm px-1 py-0.5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] ' +
  'text-white/85 decoration-2 underline-offset-[6px] transition-colors ' +
  'hover:text-white hover:underline hover:decoration-[var(--colore-giallo)]'

export function NavBackoffice({ ruolo, stagioni }: { ruolo: RuoloApp; stagioni: Stagione[] }) {
  const corrente = stagioneCorrenteDa(stagioni)

  return (
    <header className="border-b-4 border-[var(--colore-giallo)] bg-[var(--colore-blu)]">
      {/*
        `flex-wrap`, non una riga sola. Con otto voci a 390px la barra era larga
        quasi il doppio del viewport e si portava dietro l'intera pagina: il
        primo gesto su un telefono era uno scroll orizzontale. Le voci vanno a
        capo, restano tutte visibili e nessuna finisce fuori schermo.
      */}
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/gestione" className="mr-1 flex items-center gap-2.5">
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

        {corrente && (
          <>
            <Link href={`/${corrente.codice}/squadre`} className={VOCE}>Squadre</Link>
            <Link href={`/${corrente.codice}/tesseramenti`} className={VOCE}>Tesserati</Link>
            <Link href={`/${corrente.codice}/presenze`} className={VOCE}>Presenze</Link>
            <Link href={`/${corrente.codice}/statistiche`} className={VOCE}>Statistiche</Link>
            {/* Nessuna voce Quote per l'allenatore: le due tabelle finanziarie
                non hanno policy per lui, e la pagina lo rimanderebbe indietro. */}
            {ruolo !== 'allenatore' && (
              <Link href={`/${corrente.codice}/quote`} className={VOCE}>Quote</Link>
            )}
          </>
        )}
        <Link href="/anagrafica" className={VOCE}>Anagrafica</Link>
        {ruolo === 'admin' && <Link href="/admin/stagioni" className={VOCE}>Stagioni</Link>}
        {ruolo === 'admin' && <Link href="/admin/utenti" className={VOCE}>Utenti</Link>}

        <form action="/logout" method="post" className="ml-auto">
          <button
            type="submit"
            className="rounded-sm border-2 border-[var(--colore-nero)] bg-[var(--colore-giallo)] px-2.5 py-1 font-[family-name:var(--font-archivo-black)] text-[0.6875rem] uppercase tracking-[0.09em] text-[var(--colore-nero)] hover:bg-[var(--colore-giallo-cupo)]"
          >
            Esci
          </button>
        </form>
      </nav>
    </header>
  )
}
