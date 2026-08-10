import type { Risultato } from '@/lib/azioni'
import { formattaEuro } from '@/lib/domain/denaro'
import type { Pagamento, RigaQuota } from '@/lib/repos/quote'
import { PannelloQuota } from './PannelloQuota'
import { RigaImporto } from './RigaImporto'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * La quota nella scheda del tesserato: l'importo personale a tendina, il saldo e
 * il registro dei versamenti.
 *
 * Stava dentro la pagina, che con l'arrivo del materiale sportivo ha passato le
 * centocinquanta righe. Il pezzo che se ne stacca meglio è questo: l'unico che
 * porta con sé una decisione di interfaccia — la tendina chiusa — invece di
 * limitarsi a comporre.
 */
export function SezioneQuota({
  quota,
  pagamenti,
  override,
  impostaImporto,
  rimuoviImporto,
  registra,
  annulla,
  oggi,
  modificabile,
}: {
  quota: RigaQuota
  pagamenti: Pagamento[]
  override: number | null
  impostaImporto: Azione
  /** Assente per chi non è admin: l'importo personale si toglie, non si azzera. */
  rimuoviImporto?: () => Promise<Risultato<null>>
  registra: Azione
  annulla: (pagamentoId: string) => Promise<Risultato<null>>
  oggi: string
  modificabile: boolean
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Quota di iscrizione</h2>
      {/*
        A tendina, chiusa: un importo personale è l'eccezione — la quota arriva
        dalla stagione o dalla squadra, e questo campo serve alla famiglia con
        l'accordo diverso dalle altre. Sempre aperto occupava il primo posto sotto
        il titolo, davanti al saldo, che è la cosa che si viene a vedere. Il
        riepilogo nel `summary` dice l'importo che vale adesso, così non serve
        aprirla per saperlo.
      */}
      <details className="rounded-lg border bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm">
          Importo personale
          <span className="ml-2 text-neutral-600">
            {override !== null
              ? formattaEuro(override)
              : quota.quotaAttesa > 0
                ? `nessuno · vale ${formattaEuro(quota.quotaAttesa)} da ${quota.livelloImporto}`
                : 'nessuno'}
          </span>
        </summary>
        <RigaImporto
          etichetta="Importo personale"
          valore={override}
          ereditato={
            override === null && quota.quotaAttesa > 0
              ? { importo: quota.quotaAttesa, da: quota.livelloImporto }
              : null
          }
          azione={impostaImporto}
          rimuovi={rimuoviImporto}
          modificabile={modificabile}
        />
      </details>
      <PannelloQuota
        quota={quota}
        pagamenti={pagamenti}
        registra={registra}
        annulla={annulla}
        oggi={oggi}
        modificabile={modificabile}
      />
    </div>
  )
}
