import type { Anomalia, VecchiaStagione } from './tipi'

/**
 * '2024/2025' → '2024-25'. Solo nomi nella forma AAAA/AAAA con anni
 * consecutivi: qualunque altra cosa è un'anomalia da sistemare nel vecchio
 * sistema, non un codice tirato a indovinare — il codice è un segmento di
 * URL e una chiave naturale, un errore qui si propaga ovunque.
 */
export function trasformaStagione(v: VecchiaStagione):
  | { ok: true; stagione: { codice: string; etichetta: string; data_inizio: string; data_fine: string; stato: 'aperta' | 'chiusa' } }
  | { ok: false; anomalia: Anomalia } {
  const forma = v.nome.match(/^(\d{4})\/(\d{4})$/)
  if (!forma || Number(forma[2]) !== Number(forma[1]) + 1) {
    return {
      ok: false,
      anomalia: {
        tipo: 'stagione_nome_invalido',
        id: v.id,
        chiave: v.nome,
        dettaglio: `il nome '${v.nome}' non è nella forma AAAA/AAAA+1: correggerlo nel vecchio sistema`,
      },
    }
  }
  return {
    ok: true,
    stagione: {
      codice: `${forma[1]}-${forma[2].slice(2)}`,
      etichetta: `Stagione ${v.nome}`,
      data_inizio: v.data_inizio,
      data_fine: v.data_fine,
      stato: v.archiviata ? 'chiusa' : 'aperta',
    },
  }
}

/**
 * Gli importi delle quote non esistono nello storico: arrivano da CLI come
 * '2024-25=350'. Errore fatale, non anomalia: senza quote giuste è meglio
 * non partire affatto.
 */
export function analizzaQuote(argomenti: string[]): Map<string, number> {
  const quote = new Map<string, number>()
  for (const arg of argomenti) {
    const [codice, importo, ...resto] = arg.split('=')
    if (!codice?.match(/^\d{4}-\d{2}$/)) {
      throw new Error(`'${arg}': il codice stagione deve essere nella forma 2024-25`)
    }
    const valore = Number(importo)
    if (resto.length > 0 || importo === '' || Number.isNaN(valore) || valore < 0) {
      throw new Error(`'${arg}': la quota deve essere un importo non negativo`)
    }
    quote.set(codice, valore)
  }
  return quote
}
