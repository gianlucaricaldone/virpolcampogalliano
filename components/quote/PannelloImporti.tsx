'use client'

import { useState } from 'react'
import type { Risultato } from '@/lib/azioni'
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
  const [aperto, setAperto] = useState(false)

  return (
    <section className="rounded-lg border bg-white">
      <button
        type="button"
        onClick={() => setAperto(!aperto)}
        className="flex w-full items-center justify-between p-3 text-left text-sm font-medium"
      >
        <span>Importi della stagione</span>
        <span className="text-neutral-500">{aperto ? 'nascondi' : 'mostra'}</span>
      </button>

      {aperto && (
        <div>
          <RigaImporto
            etichetta={`Default ${etichettaStagione}`}
            valore={importoStagione}
            azione={azioneStagione}
            modificabile={modificabile}
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
        </div>
      )}
    </section>
  )
}
