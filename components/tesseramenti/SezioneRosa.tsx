import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'
import type { StatoQuota } from '@/lib/repos/quote'
import type { Tesserato } from '@/lib/repos/tesseramenti'
import { FormNuovoGiocatore } from './FormNuovoGiocatore'
import { FormTesseraInSquadra } from './FormTesseraInSquadra'
import { TabellaTesserati } from './TabellaTesserati'

type Azione = (precedente: Risultato<null> | null, form: FormData) => Promise<Risultato<null>>

/**
 * La rosa della squadra e, per chi può scrivere, i due modi di aggiungerci
 * qualcuno: cercarlo in anagrafica o crearlo sul posto.
 *
 * Non c'è più nessun parametro di ricerca nell'URL né nessun elenco di candidati
 * calcolato dal server: la ricerca vive dentro l'autocomplete, che interroga una
 * Server Action mentre si scrive. Prima ogni ricerca era un ricaricamento della
 * pagina intera, con 186 tesserati e 26 incarichi riletti per mostrare tre nomi.
 */
export function SezioneRosa({
  rosa,
  codiceStagione,
  quotaPerTesseramento,
  visitaConsegnata,
  mostraQuota,
  cerca,
  azione,
  azioneNuovo,
  modificabile,
}: {
  rosa: Tesserato[]
  codiceStagione: string
  quotaPerTesseramento: Map<string, StatoQuota>
  visitaConsegnata: Map<string, boolean>
  mostraQuota: boolean
  cerca: (testo: string) => Promise<Risultato<Persona[]>>
  azione: Azione
  azioneNuovo: Azione
  modificabile: boolean
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Rosa ({rosa.length})</h2>
      <TabellaTesserati
        tesserati={rosa}
        codiceStagione={codiceStagione}
        quotaPerTesseramento={quotaPerTesseramento}
        visitaConsegnata={visitaConsegnata}
        mostraQuota={mostraQuota}
        mostraSquadra={false}
        vuoto="Nessun tesserato in questa squadra."
      />

      {modificabile && (
        <>
          <FormTesseraInSquadra cerca={cerca} azione={azione} />
          <FormNuovoGiocatore azione={azioneNuovo} />
        </>
      )}
    </div>
  )
}
