import { formattaData } from '@/lib/domain/data'

type Visita = {
  stato: 'mancante' | 'scaduta' | 'in_scadenza' | 'valida'
  giorniAllaScadenza: number | null
  scadenza: string | null
}

/**
 * Solo formattazione: lo stato arriva già deciso da `v_visite`, qui si
 * traduce in una frase. Se un giorno servisse "in scadenza" con una soglia
 * diversa dai 30 giorni, si cambia la vista — non questa funzione.
 */
export function descrizioneVisita(visita: Visita): string {
  switch (visita.stato) {
    case 'mancante':
      return 'Nessuna visita registrata'
    case 'scaduta': {
      const giorni = Math.abs(visita.giorniAllaScadenza ?? 0)
      return giorni === 1 ? 'Scaduta da 1 giorno' : `Scaduta da ${giorni} giorni`
    }
    case 'in_scadenza': {
      const giorni = visita.giorniAllaScadenza ?? 0
      if (giorni === 0) return 'Scade oggi'
      return giorni === 1 ? 'Scade domani' : `Scade fra ${giorni} giorni`
    }
    case 'valida':
      return `Valida fino al ${formattaData(visita.scadenza)}`
  }
}

export const COLORE_VISITA: Record<Visita['stato'], string> = {
  mancante: 'bg-red-100 text-red-900',
  scaduta: 'bg-red-100 text-red-900',
  in_scadenza: 'bg-amber-100 text-amber-900',
  valida: 'bg-green-100 text-green-900',
}
