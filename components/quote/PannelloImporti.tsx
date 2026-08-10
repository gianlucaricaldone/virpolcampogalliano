import type { Risultato } from '@/lib/azioni'
import { formattaEuro } from '@/lib/domain/denaro'
import type { Squadra } from '@/lib/repos/squadre'
import { RigaImporto } from './RigaImporto'

type Azione = (
  precedente: Risultato<null> | null,
  form: FormData,
) => Promise<Risultato<null>>

/**
 * Gli importi si configurano su tre livelli e la risoluzione è
 * COALESCE(tesseramento, squadra, stagione, 0). Qui si vedono i primi due; il
 * terzo sta sulla scheda del singolo tesserato, dove ha senso guardarlo.
 *
 * Le azioni arrivano già associate al loro livello: una funzione che le
 * costruisse qui non attraverserebbe il confine server/client, dove passano
 * solo i riferimenti alle Server Action.
 *
 * `<details>` e non un pulsante con uno stato React: era l'unica ragione per cui
 * questo componente era 'use client'. Il riepilogo nel summary dice l'importo
 * base e quante squadre se ne discostano — le due cose per cui si apriva il
 * pannello.
 */
export function PannelloImporti({
  etichettaStagione,
  squadre,
  importoStagione,
  importiSquadre,
  azioneStagione,
  azioniSquadre,
  rimozioniSquadre,
  modificabile,
}: {
  etichettaStagione: string
  squadre: Squadra[]
  importoStagione: number | null
  importiSquadre: Record<string, number>
  azioneStagione: Azione
  azioniSquadre: Record<string, Azione>
  rimozioniSquadre: Record<string, () => Promise<Risultato<null>>>
  modificabile: boolean
}) {
  const conProprio = squadre.filter((s) => importiSquadre[s.id] !== undefined).length

  return (
    <details className="rounded-lg border bg-white">
      <summary className="cursor-pointer p-3 text-sm font-medium">
        Importi della stagione
        <span className="ml-2 font-normal text-neutral-600">
          {importoStagione !== null
            ? `base ${formattaEuro(importoStagione)}`
            : 'nessun importo base'}
          {conProprio > 0
            ? ` · ${conProprio} ${conProprio === 1 ? 'squadra' : 'squadre'} con importo proprio`
            : ' · nessuna squadra si discosta'}
        </span>
      </summary>

      {/* Intestazione delle colonne: le righe sono form distinti e non celle di
          una tabella, quindi i nomi delle colonne vanno detti qui una volta. */}
      <div className="grid gap-x-3 border-t bg-neutral-100 px-3 py-1.5 text-xs uppercase tracking-wide text-neutral-600 sm:grid-cols-[minmax(8rem,16rem)_8rem_auto_1fr]">
        <span>Livello</span>
        <span>Importo</span>
      </div>

      <RigaImporto
        etichetta={`Tutta la stagione ${etichettaStagione}`}
        valore={importoStagione}
        azione={azioneStagione}
        modificabile={modificabile}
        evidenziata
      />
      {squadre.map((s) => (
        <RigaImporto
          key={s.id}
          etichetta={s.nome}
          valore={importiSquadre[s.id] ?? null}
          ereditato={
            importoStagione !== null ? { importo: importoStagione, da: 'stagione' } : null
          }
          azione={azioniSquadre[s.id]}
          rimuovi={rimozioniSquadre[s.id]}
          modificabile={modificabile}
        />
      ))}
    </details>
  )
}
