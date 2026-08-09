import Link from 'next/link'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { FormNuovoGiocatore } from './FormNuovoGiocatore'
import { FormTesseraInSquadra } from './FormTesseraInSquadra'
import { TabellaTesserati } from './TabellaTesserati'

/**
 * La rosa della squadra e, per chi può scrivere, il modo di aggiungerci
 * qualcuno senza passare dall'elenco generale dei tesseramenti.
 *
 * La ricerca precede l'elenco dei candidati, come nella scheda staff e nella
 * pagina di nuovo tesseramento: duecento persone in una lista di radio button
 * non le scorre nessuno. Il parametro sta nell'URL (`rosa`) e non in uno stato
 * client, così la ricerca sopravvive al ricaricamento della pagina dopo un
 * tesseramento riuscito.
 */
export function SezioneRosa({
  rosa,
  codiceStagione,
  ricerca,
  trovate,
  candidati,
  azione,
  azioneNuovo,
  modificabile,
}: {
  rosa: Tesserato[]
  codiceStagione: string
  ricerca: string | undefined
  trovate: Persona[]
  candidati: Persona[]
  azione: (precedente: Risultato<null> | null, form: FormData) => Promise<Risultato<null>>
  azioneNuovo: (precedente: Risultato<null> | null, form: FormData) => Promise<Risultato<null>>
  modificabile: boolean
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Rosa ({rosa.length})</h2>
      <TabellaTesserati tesserati={rosa} codiceStagione={codiceStagione} mostraSquadra={false} />

      {modificabile && (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="rosa" className="block text-sm font-medium">
                Cerca in anagrafica
              </label>
              <input
                id="rosa"
                name="rosa"
                defaultValue={ricerca ?? ''}
                placeholder="Cognome"
                className="mt-1.5 rounded-md border px-3 text-sm"
              />
            </div>
            <button type="submit" className="bottone-secondario">
              Cerca
            </button>
          </form>

          {ricerca && candidati.length === 0 && (
            <p className="rounded-lg border bg-white p-4 text-neutral-600">
              {trovate.length > 0
                ? 'Le persone trovate sono già tesserate in questa stagione.'
                : 'Nessuna persona trovata. '}
              <Link href="/anagrafica/nuova" className="underline">
                Inseriscila in anagrafica
              </Link>
              .
            </p>
          )}

          {candidati.length > 0 && (
            <FormTesseraInSquadra candidati={candidati} azione={azione} />
          )}

          <FormNuovoGiocatore azione={azioneNuovo} />
        </>
      )}
    </div>
  )
}
