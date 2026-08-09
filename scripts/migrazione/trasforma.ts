import type { Anomalia, VecchiaStagione, VecchioTesserato, VecchioUtente } from './tipi'

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
    if (resto.length > 0 || importo?.trim() === '' || !Number.isFinite(valore) || valore < 0) {
      throw new Error(`'${arg}': la quota deve essere un importo non negativo`)
    }
    quote.set(codice, valore)
  }
  return quote
}

export type NuovaPersona = {
  chiave: string
  nome: string
  cognome: string
  data_nascita: string
  codice_fiscale: string | null
  email: string | null
  telefono: string | null
  indirizzo: string | null
  citta: string | null
  cap: string | null
}

export type NuovoAccount = {
  email: string
  ruolo: 'admin' | 'dirigente' | 'allenatore'
  personaChiave: string | null
  nomePerPassword: string
}

/**
 * Chiave naturale di una persona: codice fiscale se c'è, altrimenti la terna
 * cognome+nome+nascita. Prefissi diversi perché le due forme non devono mai
 * collidere fra loro.
 */
export function chiavePersona(p: {
  codice_fiscale?: string | null
  cognome: string
  nome: string
  data_nascita?: string | null
}): string {
  const cf = p.codice_fiscale?.trim().toUpperCase()
  if (cf) return `cf:${cf}`
  return `terna:${p.cognome.trim().toLowerCase()}|${p.nome.trim().toLowerCase()}|${p.data_nascita ?? ''}`
}

/** Cognome+nome normalizzati: il ponte fra `users` (senza CF né nascita) e i tesserati. */
export function chiaveCognomeNome(cognome: string, nome: string): string {
  return `${cognome.trim().toLowerCase()}|${nome.trim().toLowerCase()}`
}

export function trasformaTesserati(tesserati: VecchioTesserato[]): {
  persone: NuovaPersona[]
  anomalie: Anomalia[]
} {
  const perChiave = new Map<string, VecchioTesserato[]>()
  for (const t of tesserati) {
    const chiave = chiavePersona(t)
    perChiave.set(chiave, [...(perChiave.get(chiave) ?? []), t])
  }

  const persone: NuovaPersona[] = []
  const anomalie: Anomalia[] = []
  for (const [chiave, gruppo] of perChiave) {
    if (gruppo.length > 1) {
      // Nessuno dei due migra: scegliere a caso significherebbe attaccare
      // presenze e pagamenti alla persona sbagliata, in silenzio.
      for (const t of gruppo) {
        anomalie.push({
          tipo: 'tesserato_terna_duplicata',
          id: t.id,
          chiave,
          dettaglio: `${gruppo.length} tesserati con la stessa chiave '${chiave}': disambiguare nel vecchio sistema`,
        })
      }
      continue
    }
    const t = gruppo[0]
    persone.push({
      chiave,
      nome: t.nome,
      cognome: t.cognome,
      data_nascita: t.data_nascita,
      codice_fiscale: t.codice_fiscale?.trim().toUpperCase() ?? null,
      email: t.email,
      telefono: t.telefono,
      indirizzo: t.indirizzo,
      citta: t.citta,
      cap: t.cap,
    })
  }
  return { persone, anomalie }
}

const RUOLO_NUOVO: Record<string, 'admin' | 'dirigente' | 'allenatore'> = {
  admin: 'admin',
  dirigente: 'dirigente',
  allenatore: 'allenatore',
  vice_allenatore: 'allenatore',
}
/** admin > dirigente > allenatore: con più ruoli vince il più alto. */
const PRIORITA = ['admin', 'dirigente', 'allenatore'] as const

/**
 * Dal vecchio `users` agli account nuovi. `personePerCognomeNome` mappa
 * cognome|nome (normalizzati) → chiave della persona migrata: è il solo
 * ponte possibile, perché `users` non ha né codice fiscale né data di
 * nascita.
 */
export function trasformaStaff(
  utenti: VecchioUtente[],
  personePerCognomeNome: Map<string, string>,
): { account: NuovoAccount[]; scartati: number; anomalie: Anomalia[] } {
  const anomalie: Anomalia[] = []
  let scartati = 0

  // Prima passata: ruolo e filtro dei non-staff.
  const candidati: { utente: VecchioUtente; ruolo: 'admin' | 'dirigente' | 'allenatore' }[] = []
  for (const u of utenti) {
    const ruoliVecchi = u.roles?.length ? u.roles : [u.role]
    const ruoliNuovi = ruoliVecchi
      .map((r) => RUOLO_NUOVO[r])
      .filter((r): r is 'admin' | 'dirigente' | 'allenatore' => r !== undefined)
    if (ruoliNuovi.length === 0) {
      scartati += 1
      continue
    }
    const ruolo = PRIORITA.find((p) => ruoliNuovi.includes(p))!
    candidati.push({ utente: u, ruolo })
  }

  // Email duplicate: auth.users le rifiuterebbe una alla volta, con l'esito
  // deciso dall'ordine di arrivo. Meglio nessun account e un'anomalia chiara.
  const perEmail = new Map<string, typeof candidati>()
  for (const c of candidati) {
    const email = c.utente.email.trim().toLowerCase()
    perEmail.set(email, [...(perEmail.get(email) ?? []), c])
  }

  const account: NuovoAccount[] = []
  for (const [email, gruppo] of perEmail) {
    if (gruppo.length > 1) {
      for (const c of gruppo) {
        anomalie.push({
          tipo: 'staff_email_duplicata',
          id: c.utente.id,
          chiave: email,
          dettaglio: `${gruppo.length} utenti staff con email '${email}'`,
        })
      }
      continue
    }
    const { utente, ruolo } = gruppo[0]
    if (!utente.nome?.trim()) {
      anomalie.push({
        tipo: 'staff_senza_nome',
        id: utente.id,
        chiave: email,
        dettaglio: 'senza nome non si genera la password iniziale: completare il vecchio profilo',
      })
      continue
    }
    const personaChiave =
      utente.cognome && utente.nome
        ? (personePerCognomeNome.get(chiaveCognomeNome(utente.cognome, utente.nome)) ?? null)
        : null
    if (ruolo === 'allenatore' && !personaChiave) {
      // profili_allenatore_ha_persona esige la persona, persone.data_nascita
      // è NOT NULL e il vecchio users non ha date di nascita: senza un
      // tesserato corrispondente non c'è niente da collegare e niente da
      // inventare.
      anomalie.push({
        tipo: 'allenatore_senza_persona',
        id: utente.id,
        chiave: email,
        dettaglio: `nessun tesserato corrisponde a '${utente.cognome} ${utente.nome}': creare persona e account a mano dal backoffice`,
      })
      continue
    }
    account.push({ email, ruolo, personaChiave, nomePerPassword: utente.nome.trim() })
  }

  return { account, scartati, anomalie }
}
