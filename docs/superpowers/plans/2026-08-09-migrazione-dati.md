# Migrazione dei dati dal sistema vecchio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/migra.ts` legge il progetto Supabase vecchio, trasforma e scrive nel nuovo, con dry-run per default e un report di conteggi e anomalie che si legge prima di dare l'ok.

**Architecture:** le trasformazioni sono funzioni pure in `scripts/migrazione/`, testate a unit senza database; `migra.ts` orchestra I/O (lettura paginata dal vecchio con service role, scritture ordinate nel nuovo col client admin esistente) e resta sottile. Idempotenza per chiavi naturali: ciò che esiste già nel target si salta, mai si sovrascrive.

**Tech Stack:** invariato — TypeScript, supabase-js, zod, Vitest 4. Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-08-09-migrazione-dati-design.md`

## Global Constraints

Valgono tutte quelle di `CLAUDE.md`. Quelle sotto pressione qui:

- **Le due service role vivono solo in `scripts/`.** Il lato nuovo usa `lib/supabase/admin` (già recintato); il lato vecchio ha env proprie `VECCHIO_SUPABASE_URL` e `VECCHIO_SERVICE_ROLE_KEY`, lette solo da `scripts/migrazione/vecchio.ts`. Niente credenziali committate: valori in `.env.local`, nomi in `.env.example`.
- **Lo script non scrive MAI nel vecchio database.** Solo `select` verso il lato vecchio.
- **Dry-run per default.** Senza `--esegui` nessuna scrittura sul target, ma il report esce comunque.
- **Lo script non ripara e non inventa dati.** Ciò che non si può migrare fedelmente è un'anomalia nel report, con id e chiave.
- **Idempotenza = salta.** Riga già presente per chiave naturale → contata «già presente», mai aggiornata.
- Nomi di dominio e testi in italiano; parole chiave tecniche in inglese.
- Commit: prefisso convenzionale inglese, corpo italiano che spiega **perché**.
- Ordine dei test: `npm run db:reset && npm run test:db && npm run test:unit`, poi `npm run seed:dev && npm run test:e2e`. I task di questo piano toccano solo `test:unit`: basta quello nei task 1–5; il task 6 esegue anche il resto.

## File Structure

| File | Responsabilità |
|---|---|
| `scripts/migrazione/tipi.ts` | forme delle righe vecchie e nuove, anomalie, conteggi |
| `scripts/migrazione/trasforma.ts` | tutte le trasformazioni pure |
| `scripts/migrazione/report.ts` | dal risultato al markdown del report, puro |
| `scripts/migrazione/vecchio.ts` | client del progetto vecchio + letture paginate |
| `scripts/migra.ts` | CLI, orchestrazione, idempotenza, scritture, account |
| `tests/unit/migrazione-trasforma.test.ts` | test delle trasformazioni |
| `tests/unit/migrazione-report.test.ts` | test del report |
| `.env.example` | i due nomi di variabile del lato vecchio |
| `package.json` | script `migra` |

## Fatti verificati sui due schemi (fonte di verità per ogni task)

**Vecchio** (hosted, 47 migration):
- `users`: `id` (uuid = auth), `email`, `role` (enum: admin, dirigente, allenatore, vice_allenatore, tesserato, genitore), `roles` (array dello stesso enum, può essere vuoto/null), `nome`, `cognome`, `telefono`.
- `tesserati`: `id`, `nome`, `cognome`, `data_nascita` (not null), `codice_fiscale` (unique, può mancare dopo la migration 028), `email`, `telefono`, `indirizzo`, `citta`, `cap`. Nessuno stato.
- `stagioni_sportive`: `id`, `nome` ('2024/2025'), `data_inizio`, `data_fine`, `attiva`, `archiviata`.
- `squadre`: `id`, `nome`, `categoria`, `annata` (int), `stagione_id` (nullable).
- `tesserati_squadre_stagioni`: `id`, `tesserato_id`, `squadra_id`, `stagione_id` (tutti not null), `numero_maglia`, `data_tesseramento`, `note`. Stesso tesserato in più squadre per stagione: possibile.
- `tesserati_dati_stagionali`: `id`, `tesserato_id`, `stagione_id`, `stato_pagamento` (text: pagato, non_pagato, parziale, in_sospeso), `note_pagamento`, `visita_sportiva` (bool), `scadenza_certificato` (date, nullable), `updated_at`. UNIQUE (tesserato, stagione).
- `presenze`: `id`, `tesserato_id`, `squadra_id` (nullable), `stagione_id` (nullable), `data`, `tipo` (enum: allenamento, partita, torneo, evento), `presente` (bool), `note`.

**Nuovo** (7 migration baseline):
- `persone`: `nome`, `cognome`, `data_nascita` **not null**, `codice_fiscale` unique nullable, `email`, `telefono`, `indirizzo`, `citta`, `cap`, `attiva`.
- `profili`: `id` = auth uid, `persona_id` nullable (**not null se ruolo allenatore**, vincolo `profili_allenatore_ha_persona`), `ruolo` (admin, dirigente, allenatore), `attivo`.
- `stagioni`: `codice` unique con check `^\d{4}-\d{2}$`, `etichetta`, `data_inizio`, `data_fine`, `stato` (aperta, chiusa).
- `squadre`: `stagione_id` not null, `nome`, `categoria` **not null**, `annata` nullable, unique (stagione_id, nome).
- `tesseramenti`: `persona_id`, `stagione_id` not null, `squadra_id` nullable (FK composita con la stagione), `numero_maglia` 1–99 o null, `visita_scadenza` date nullable, `note`. **unique (persona_id, stagione_id)**.
- `quote_importi`: esattamente uno fra `stagione_id`/`squadra_id`/`tesseramento_id`, `importo >= 0`.
- `pagamenti_quota`: `tesseramento_id`, `importo > 0`, `data`, `metodo` (default 'contanti'), `note`, `registrato_da` nullable.
- `sedute_allenamento`: `squadra_id` + `stagione_id` (FK composita), `data`, `ora_inizio` nullable, unique nulls not distinct (squadra_id, data, ora_inizio), `created_by` nullable.
- `presenze`: `seduta_id`, `tesseramento_id`, `squadra_id` not null (FK composite su entrambi i lati), `stato` (presente, assente, giustificato, infortunato), unique (seduta_id, tesseramento_id).

Vincolo incrociato da rispettare in `migra.ts`: la squadra di una presenza deve essere la squadra sia della seduta sia del tesseramento — quindi **una presenza si migra solo se il tesseramento migrato della persona in quella stagione ha la stessa squadra della seduta**; altrimenti è scartata con motivo.

---

## Task 1: Tipi e trasformazioni di stagioni e quote

**Files:**
- Create: `scripts/migrazione/tipi.ts`
- Create: `scripts/migrazione/trasforma.ts`
- Create: `tests/unit/migrazione-trasforma.test.ts`

**Interfaces:**
- Produces (in `tipi.ts`):
  - `type Anomalia = { tipo: string; id: string; chiave: string; dettaglio: string }`
  - `type VecchiaStagione = { id: string; nome: string; data_inizio: string; data_fine: string; archiviata: boolean }`
  - `type VecchioUtente = { id: string; email: string; role: string; roles: string[] | null; nome: string | null; cognome: string | null; telefono: string | null }`
  - `type VecchioTesserato = { id: string; nome: string; cognome: string; data_nascita: string; codice_fiscale: string | null; email: string | null; telefono: string | null; indirizzo: string | null; citta: string | null; cap: string | null }`
  - `type VecchiaSquadra = { id: string; nome: string; categoria: string; annata: number | null; stagione_id: string | null }`
  - `type VecchioTesseramentoSquadra = { id: string; tesserato_id: string; squadra_id: string; stagione_id: string; numero_maglia: number | null; data_tesseramento: string | null; note: string | null }`
  - `type VecchiDatiStagionali = { id: string; tesserato_id: string; stagione_id: string; stato_pagamento: string; note_pagamento: string | null; visita_sportiva: boolean; scadenza_certificato: string | null; updated_at: string }`
  - `type VecchiaPresenza = { id: string; tesserato_id: string; squadra_id: string | null; stagione_id: string | null; data: string; tipo: string; presente: boolean; note: string | null }`
- Produces (in `trasforma.ts`):
  - `trasformaStagione(v: VecchiaStagione): { ok: true; stagione: { codice: string; etichetta: string; data_inizio: string; data_fine: string; stato: 'aperta' | 'chiusa' } } | { ok: false; anomalia: Anomalia }`
  - `analizzaQuote(argomenti: string[]): Map<string, number>` — da `['2024-25=350', ...]`; lancia `Error` su formato invalido

- [ ] **Step 1: Scrivere i tipi**

Crea `scripts/migrazione/tipi.ts`:

```ts
/**
 * Forme delle righe del vecchio schema (hosted, 47 migration) così come
 * escono da PostgREST, e strutture di lavoro della migrazione. Solo i campi
 * che la migrazione legge: il resto non esiste per questo script.
 */

export type Anomalia = {
  /** classe dell'anomalia, es. 'stagione_nome_invalido' */
  tipo: string
  /** id della riga vecchia */
  id: string
  /** chiave naturale leggibile, per ritrovare la riga a occhio */
  chiave: string
  dettaglio: string
}

export type VecchiaStagione = {
  id: string
  nome: string
  data_inizio: string
  data_fine: string
  archiviata: boolean
}

export type VecchioUtente = {
  id: string
  email: string
  role: string
  roles: string[] | null
  nome: string | null
  cognome: string | null
  telefono: string | null
}

export type VecchioTesserato = {
  id: string
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

export type VecchiaSquadra = {
  id: string
  nome: string
  categoria: string
  annata: number | null
  stagione_id: string | null
}

export type VecchioTesseramentoSquadra = {
  id: string
  tesserato_id: string
  squadra_id: string
  stagione_id: string
  numero_maglia: number | null
  data_tesseramento: string | null
  note: string | null
}

export type VecchiDatiStagionali = {
  id: string
  tesserato_id: string
  stagione_id: string
  stato_pagamento: string
  note_pagamento: string | null
  visita_sportiva: boolean
  scadenza_certificato: string | null
  updated_at: string
}

export type VecchiaPresenza = {
  id: string
  tesserato_id: string
  squadra_id: string | null
  stagione_id: string | null
  data: string
  tipo: string
  presente: boolean
  note: string | null
}
```

- [ ] **Step 2: Scrivere i test che falliscono**

Crea `tests/unit/migrazione-trasforma.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { analizzaQuote, trasformaStagione } from '@/scripts/migrazione/trasforma'

const STAGIONE = {
  id: 'v-1',
  nome: '2024/2025',
  data_inizio: '2024-09-01',
  data_fine: '2025-06-30',
  archiviata: true,
}

describe('trasformaStagione', () => {
  it("da '2024/2025' ricava codice, etichetta e stato", () => {
    const esito = trasformaStagione(STAGIONE)
    expect(esito).toEqual({
      ok: true,
      stagione: {
        codice: '2024-25',
        etichetta: 'Stagione 2024/2025',
        data_inizio: '2024-09-01',
        data_fine: '2025-06-30',
        stato: 'chiusa',
      },
    })
  })

  it('non archiviata resta aperta', () => {
    const esito = trasformaStagione({ ...STAGIONE, archiviata: false })
    if (!esito.ok) throw new Error('attesa stagione valida')
    expect(esito.stagione.stato).toBe('aperta')
  })

  it('un nome che non è AAAA/AAAA è anomalia, non un codice inventato', () => {
    const esito = trasformaStagione({ ...STAGIONE, nome: 'Stagione vecchia' })
    if (esito.ok) throw new Error('attesa anomalia')
    expect(esito.anomalia.tipo).toBe('stagione_nome_invalido')
    expect(esito.anomalia.id).toBe('v-1')
  })

  it('anni non consecutivi sono anomalia: il codice mentirebbe', () => {
    const esito = trasformaStagione({ ...STAGIONE, nome: '2024/2026' })
    expect(esito.ok).toBe(false)
  })
})

describe('analizzaQuote', () => {
  it('legge coppie codice=importo', () => {
    const quote = analizzaQuote(['2024-25=350', '2025-26=380.50'])
    expect(quote.get('2024-25')).toBe(350)
    expect(quote.get('2025-26')).toBe(380.5)
  })

  it('rifiuta importi non numerici o negativi', () => {
    expect(() => analizzaQuote(['2024-25=tanto'])).toThrow(/quota/i)
    expect(() => analizzaQuote(['2024-25=-5'])).toThrow(/quota/i)
  })

  it('rifiuta un codice che non è un codice stagione', () => {
    expect(() => analizzaQuote(['2024/2025=350'])).toThrow(/codice/i)
  })
})
```

- [ ] **Step 3: Eseguire e osservare il rosso**

Run: `npm run test:unit -- migrazione-trasforma`
Expected: FAIL, modulo `scripts/migrazione/trasforma` inesistente.

- [ ] **Step 4: Implementare**

Crea `scripts/migrazione/trasforma.ts`:

```ts
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
```

- [ ] **Step 5: Verificare il verde**

Run: `npm run test:unit -- migrazione-trasforma && npm run type-check`
Expected: 7 test verdi.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrazione tests/unit/migrazione-trasforma.test.ts
git commit -m "feat(migrazione): tipi del vecchio schema, stagioni e quote"
```

---

## Task 2: Trasformazione di anagrafica e staff

**Files:**
- Modify: `scripts/migrazione/trasforma.ts`
- Modify: `tests/unit/migrazione-trasforma.test.ts`

**Interfaces:**
- Consumes: tipi del Task 1.
- Produces (aggiunte a `trasforma.ts`):
  - `type NuovaPersona = { chiave: string; nome: string; cognome: string; data_nascita: string; codice_fiscale: string | null; email: string | null; telefono: string | null; indirizzo: string | null; citta: string | null; cap: string | null }`
  - `type NuovoAccount = { email: string; ruolo: 'admin' | 'dirigente' | 'allenatore'; personaChiave: string | null; nomePerPassword: string }`
  - `chiavePersona(p: { codice_fiscale?: string | null; cognome: string; nome: string; data_nascita?: string | null }): string`
  - `trasformaTesserati(tesserati: VecchioTesserato[]): { persone: NuovaPersona[]; anomalie: Anomalia[] }`
  - `trasformaStaff(utenti: VecchioUtente[], personePerCognomeNome: Map<string, string>): { account: NuovoAccount[]; scartati: number; anomalie: Anomalia[] }`

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/migrazione-trasforma.test.ts`, aggiungi:

```ts
import {
  chiavePersona,
  trasformaStaff,
  trasformaTesserati,
} from '@/scripts/migrazione/trasforma'

const TESSERATO = {
  id: 't-1',
  nome: 'Marco',
  cognome: 'Rossi',
  data_nascita: '2012-03-04',
  codice_fiscale: 'RSSMRC12C04B819X',
  email: null,
  telefono: null,
  indirizzo: null,
  citta: null,
  cap: null,
}

describe('chiavePersona', () => {
  it('preferisce il codice fiscale, normalizzato', () => {
    expect(chiavePersona({ codice_fiscale: ' rssmrc12c04b819x ', cognome: 'X', nome: 'Y' }))
      .toBe('cf:RSSMRC12C04B819X')
  })

  it('senza codice fiscale usa la terna normalizzata', () => {
    expect(chiavePersona({ cognome: " D'Angelo ", nome: 'María', data_nascita: '2011-01-02' }))
      .toBe("terna:d'angelo|maría|2011-01-02")
  })
})

describe('trasformaTesserati', () => {
  it('mappa i campi anagrafici', () => {
    const { persone, anomalie } = trasformaTesserati([TESSERATO])
    expect(anomalie).toEqual([])
    expect(persone).toEqual([{
      chiave: 'cf:RSSMRC12C04B819X',
      nome: 'Marco',
      cognome: 'Rossi',
      data_nascita: '2012-03-04',
      codice_fiscale: 'RSSMRC12C04B819X',
      email: null,
      telefono: null,
      indirizzo: null,
      citta: null,
      cap: null,
    }])
  })

  it('due tesserati senza CF con la stessa terna sono anomalia, nessuno dei due migra', () => {
    const a = { ...TESSERATO, id: 't-1', codice_fiscale: null }
    const b = { ...TESSERATO, id: 't-2', codice_fiscale: null }
    const { persone, anomalie } = trasformaTesserati([a, b])
    expect(persone).toEqual([])
    expect(anomalie).toHaveLength(2)
    expect(anomalie[0].tipo).toBe('tesserato_terna_duplicata')
  })
})

describe('trasformaStaff', () => {
  const UTENTE = {
    id: 'u-1',
    email: 'mister@vecchio.test',
    role: 'allenatore',
    roles: null,
    nome: 'Luca',
    cognome: 'Bianchi',
    telefono: null,
  }

  it("l'allenatore con persona corrispondente si collega a lei", () => {
    const persone = new Map([['bianchi|luca', 'cf:BNCLCU80A01F257K']])
    const { account, anomalie } = trasformaStaff([UTENTE], persone)
    expect(anomalie).toEqual([])
    expect(account).toEqual([{
      email: 'mister@vecchio.test',
      ruolo: 'allenatore',
      personaChiave: 'cf:BNCLCU80A01F257K',
      nomePerPassword: 'Luca',
    }])
  })

  it("l'allenatore senza persona è anomalia: data di nascita non ricostruibile", () => {
    const { account, anomalie } = trasformaStaff([UTENTE], new Map())
    expect(account).toEqual([])
    expect(anomalie[0].tipo).toBe('allenatore_senza_persona')
  })

  it('admin e dirigente nascono anche senza persona', () => {
    const admin = { ...UTENTE, id: 'u-2', email: 'admin@vecchio.test', role: 'admin' }
    const { account, anomalie } = trasformaStaff([admin], new Map())
    expect(anomalie).toEqual([])
    expect(account[0]).toMatchObject({ ruolo: 'admin', personaChiave: null })
  })

  it("dall'array roles vince il ruolo più alto; vice_allenatore diventa allenatore", () => {
    const persone = new Map([['bianchi|luca', 'cf:X']])
    const doppio = { ...UTENTE, roles: ['vice_allenatore', 'dirigente'] }
    const { account } = trasformaStaff([doppio], persone)
    expect(account[0].ruolo).toBe('dirigente')
  })

  it('tesserato e genitore sono scartati senza anomalia', () => {
    const genitore = { ...UTENTE, id: 'u-3', role: 'genitore', roles: null }
    const { account, scartati, anomalie } = trasformaStaff([genitore], new Map())
    expect(account).toEqual([])
    expect(scartati).toBe(1)
    expect(anomalie).toEqual([])
  })

  it('due staff con la stessa email sono anomalia, nessun account per quella email', () => {
    const a = { ...UTENTE, id: 'u-1', role: 'dirigente' }
    const b = { ...UTENTE, id: 'u-2', role: 'admin' }
    const { account, anomalie } = trasformaStaff([a, b], new Map())
    expect(account).toEqual([])
    expect(anomalie).toHaveLength(2)
    expect(anomalie[0].tipo).toBe('staff_email_duplicata')
  })

  it('staff senza nome è anomalia: la password iniziale nasce dal nome', () => {
    const anonimo = { ...UTENTE, nome: null, role: 'dirigente' }
    const { account, anomalie } = trasformaStaff([anonimo], new Map())
    expect(account).toEqual([])
    expect(anomalie[0].tipo).toBe('staff_senza_nome')
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- migrazione-trasforma`
Expected: FAIL, le funzioni nuove non esistono.

- [ ] **Step 3: Implementare**

In `scripts/migrazione/trasforma.ts`, aggiungi:

```ts
import type { VecchioTesserato, VecchioUtente } from './tipi'

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
```

- [ ] **Step 4: Verificare il verde**

Run: `npm run test:unit -- migrazione-trasforma && npm run type-check`
Expected: tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrazione/trasforma.ts tests/unit/migrazione-trasforma.test.ts
git commit -m "feat(migrazione): anagrafica e staff, con le anomalie dei dati veri"
```

---

## Task 3: Tesseramenti, visita e pagamenti ricostruiti

**Files:**
- Modify: `scripts/migrazione/trasforma.ts`
- Modify: `tests/unit/migrazione-trasforma.test.ts`

**Interfaces:**
- Consumes: tipi del Task 1, `chiavePersona` del Task 2.
- Produces:
  - `type NuovoTesseramento = { personaChiave: string; stagioneVecchiaId: string; squadraVecchiaId: string | null; numero_maglia: number | null; visita_scadenza: string | null; note: string | null }`
  - `type PagamentoRicostruito = { personaChiave: string; stagioneVecchiaId: string; importo: number; data: string }`
  - `NOTA_RICOSTRUITO = 'importo ricostruito dalla migrazione'`
  - `fondiTesseramenti(righeSquadra: VecchioTesseramentoSquadra[], datiStagionali: VecchiDatiStagionali[], tesseratiPerId: Map<string, string>): { tesseramenti: NuovoTesseramento[]; anomalie: Anomalia[] }` — `tesseratiPerId` mappa id vecchio → chiave persona (solo tesserati migrati)
  - `ricostruisciPagamenti(datiStagionali: VecchiDatiStagionali[], tesseratiPerId: Map<string, string>, quotaPerStagioneVecchia: Map<string, number>): { pagamenti: PagamentoRicostruito[]; anomalie: Anomalia[] }`

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/migrazione-trasforma.test.ts`, aggiungi:

```ts
import {
  fondiTesseramenti,
  NOTA_RICOSTRUITO,
  ricostruisciPagamenti,
} from '@/scripts/migrazione/trasforma'

const RIGA_SQUADRA = {
  id: 'tss-1',
  tesserato_id: 't-1',
  squadra_id: 'sq-1',
  stagione_id: 'st-1',
  numero_maglia: 10,
  data_tesseramento: '2024-09-15',
  note: null,
}

const DATI = {
  id: 'tds-1',
  tesserato_id: 't-1',
  stagione_id: 'st-1',
  stato_pagamento: 'pagato',
  note_pagamento: null,
  visita_sportiva: true,
  scadenza_certificato: '2025-05-01',
  updated_at: '2024-10-01T10:00:00Z',
}

const PER_ID = new Map([['t-1', 'cf:RSSMRC12C04B819X']])

describe('fondiTesseramenti', () => {
  it('fonde riga squadra e dati stagionali in un tesseramento', () => {
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA], [DATI], PER_ID)
    expect(anomalie).toEqual([])
    expect(tesseramenti).toEqual([{
      personaChiave: 'cf:RSSMRC12C04B819X',
      stagioneVecchiaId: 'st-1',
      squadraVecchiaId: 'sq-1',
      numero_maglia: 10,
      visita_scadenza: '2025-05-01',
      note: null,
    }])
  })

  it('dati stagionali senza riga squadra danno un tesseramento senza squadra', () => {
    const { tesseramenti } = fondiTesseramenti([], [DATI], PER_ID)
    expect(tesseramenti).toHaveLength(1)
    expect(tesseramenti[0].squadraVecchiaId).toBeNull()
  })

  it('più squadre nella stessa stagione sono anomalia, nessun tesseramento', () => {
    const seconda = { ...RIGA_SQUADRA, id: 'tss-2', squadra_id: 'sq-2', numero_maglia: null }
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA, seconda], [DATI], PER_ID)
    expect(tesseramenti).toEqual([])
    expect(anomalie.map((a) => a.tipo)).toEqual([
      'tesserato_multi_squadra',
      'tesserato_multi_squadra',
    ])
  })

  it('visita sportiva senza scadenza è anomalia e il tesseramento migra senza data', () => {
    const senza = { ...DATI, scadenza_certificato: null }
    const { tesseramenti, anomalie } = fondiTesseramenti([RIGA_SQUADRA], [senza], PER_ID)
    expect(tesseramenti[0].visita_scadenza).toBeNull()
    expect(anomalie[0].tipo).toBe('visita_senza_scadenza')
  })

  it('un numero maglia fuori da 1-99 migra come nullo, con anomalia', () => {
    const strano = { ...RIGA_SQUADRA, numero_maglia: 0 }
    const { tesseramenti, anomalie } = fondiTesseramenti([strano], [DATI], PER_ID)
    expect(tesseramenti[0].numero_maglia).toBeNull()
    expect(anomalie[0].tipo).toBe('numero_maglia_invalido')
  })

  it('righe di tesserati non migrati sono ignorate qui: hanno già la loro anomalia', () => {
    const { tesseramenti, anomalie } = fondiTesseramenti(
      [{ ...RIGA_SQUADRA, tesserato_id: 't-sconosciuto' }],
      [],
      PER_ID,
    )
    expect(tesseramenti).toEqual([])
    expect(anomalie).toEqual([])
  })
})

describe('ricostruisciPagamenti', () => {
  const QUOTE = new Map([['st-1', 350]])

  it("'pagato' diventa un pagamento pari alla quota, datato updated_at", () => {
    const { pagamenti } = ricostruisciPagamenti([DATI], PER_ID, QUOTE)
    expect(pagamenti).toEqual([{
      personaChiave: 'cf:RSSMRC12C04B819X',
      stagioneVecchiaId: 'st-1',
      importo: 350,
      data: '2024-10-01',
    }])
  })

  it("'parziale' vale metà quota", () => {
    const { pagamenti } = ricostruisciPagamenti(
      [{ ...DATI, stato_pagamento: 'parziale' }], PER_ID, QUOTE,
    )
    expect(pagamenti[0].importo).toBe(175)
  })

  it("'non_pagato' e 'in_sospeso' non generano pagamenti", () => {
    const { pagamenti } = ricostruisciPagamenti(
      [
        { ...DATI, id: 'a', stato_pagamento: 'non_pagato' },
        { ...DATI, id: 'b', stato_pagamento: 'in_sospeso' },
      ],
      PER_ID,
      QUOTE,
    )
    expect(pagamenti).toEqual([])
  })

  it('uno stato di pagamento sconosciuto è anomalia', () => {
    const { pagamenti, anomalie } = ricostruisciPagamenti(
      [{ ...DATI, stato_pagamento: 'boh' }], PER_ID, QUOTE,
    )
    expect(pagamenti).toEqual([])
    expect(anomalie[0].tipo).toBe('stato_pagamento_sconosciuto')
  })

  it('la nota fissa è esportata: il chiamante la scrive su ogni pagamento', () => {
    expect(NOTA_RICOSTRUITO).toBe('importo ricostruito dalla migrazione')
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- migrazione-trasforma`
Expected: FAIL sulle funzioni nuove.

- [ ] **Step 3: Implementare**

In `scripts/migrazione/trasforma.ts`, aggiungi:

```ts
import type { VecchiDatiStagionali, VecchioTesseramentoSquadra } from './tipi'

export type NuovoTesseramento = {
  personaChiave: string
  stagioneVecchiaId: string
  squadraVecchiaId: string | null
  numero_maglia: number | null
  visita_scadenza: string | null
  note: string | null
}

export type PagamentoRicostruito = {
  personaChiave: string
  stagioneVecchiaId: string
  importo: number
  data: string
}

/** Su ogni pagamento generato: distingue per sempre il ricostruito dal registrato. */
export const NOTA_RICOSTRUITO = 'importo ricostruito dalla migrazione'

/**
 * Una riga per (tesserato, stagione): la riga squadra porta squadra e maglia,
 * i dati stagionali portano la visita. Il nuovo schema ha
 * unique (persona_id, stagione_id): più squadre nella stessa stagione non
 * possono migrare, e scegliere una squadra a caso sposterebbe le presenze.
 */
export function fondiTesseramenti(
  righeSquadra: VecchioTesseramentoSquadra[],
  datiStagionali: VecchiDatiStagionali[],
  tesseratiPerId: Map<string, string>,
): { tesseramenti: NuovoTesseramento[]; anomalie: Anomalia[] } {
  const anomalie: Anomalia[] = []

  const perCoppia = new Map<string, VecchioTesseramentoSquadra[]>()
  for (const r of righeSquadra) {
    if (!tesseratiPerId.has(r.tesserato_id)) continue // già anomalo altrove
    const chiave = `${r.tesserato_id}|${r.stagione_id}`
    perCoppia.set(chiave, [...(perCoppia.get(chiave) ?? []), r])
  }

  const datiPerCoppia = new Map<string, VecchiDatiStagionali>()
  for (const d of datiStagionali) {
    if (!tesseratiPerId.has(d.tesserato_id)) continue
    datiPerCoppia.set(`${d.tesserato_id}|${d.stagione_id}`, d)
  }

  const tesseramenti: NuovoTesseramento[] = []
  const coppie = new Set([...perCoppia.keys(), ...datiPerCoppia.keys()])
  for (const coppia of coppie) {
    const righe = perCoppia.get(coppia) ?? []
    const dati = datiPerCoppia.get(coppia)
    const [tesseratoId, stagioneId] = coppia.split('|')
    const personaChiave = tesseratiPerId.get(tesseratoId)!

    if (righe.length > 1) {
      for (const r of righe) {
        anomalie.push({
          tipo: 'tesserato_multi_squadra',
          id: r.id,
          chiave: `${personaChiave} @ stagione ${stagioneId}`,
          dettaglio: `${righe.length} squadre nella stessa stagione: il nuovo schema ne ammette una, scegliere a mano`,
        })
      }
      continue
    }

    const riga = righe[0]
    let maglia = riga?.numero_maglia ?? null
    if (maglia !== null && (maglia < 1 || maglia > 99)) {
      anomalie.push({
        tipo: 'numero_maglia_invalido',
        id: riga!.id,
        chiave: `${personaChiave} @ stagione ${stagioneId}`,
        dettaglio: `numero maglia ${maglia} fuori da 1-99: migra senza numero`,
      })
      maglia = null
    }

    if (dati?.visita_sportiva && !dati.scadenza_certificato) {
      anomalie.push({
        tipo: 'visita_senza_scadenza',
        id: dati.id,
        chiave: `${personaChiave} @ stagione ${stagioneId}`,
        dettaglio: 'visita segnata consegnata ma senza scadenza: registrarla a mano, nessuna data inventata',
      })
    }

    tesseramenti.push({
      personaChiave,
      stagioneVecchiaId: stagioneId,
      squadraVecchiaId: riga?.squadra_id ?? null,
      numero_maglia: maglia,
      visita_scadenza: dati?.scadenza_certificato ?? null,
      note: riga?.note ?? null,
    })
  }
  return { tesseramenti, anomalie }
}

export function ricostruisciPagamenti(
  datiStagionali: VecchiDatiStagionali[],
  tesseratiPerId: Map<string, string>,
  quotaPerStagioneVecchia: Map<string, number>,
): { pagamenti: PagamentoRicostruito[]; anomalie: Anomalia[] } {
  const pagamenti: PagamentoRicostruito[] = []
  const anomalie: Anomalia[] = []
  for (const d of datiStagionali) {
    const personaChiave = tesseratiPerId.get(d.tesserato_id)
    if (!personaChiave) continue
    const quota = quotaPerStagioneVecchia.get(d.stagione_id)
    if (quota === undefined) continue // la stagione stessa è già anomala o senza quota: bloccato a monte

    let importo: number
    switch (d.stato_pagamento) {
      case 'pagato':
        importo = quota
        break
      case 'parziale':
        importo = quota / 2
        break
      case 'non_pagato':
      case 'in_sospeso':
        continue
      default:
        anomalie.push({
          tipo: 'stato_pagamento_sconosciuto',
          id: d.id,
          chiave: `${personaChiave} @ stagione ${d.stagione_id}`,
          dettaglio: `stato_pagamento '${d.stato_pagamento}' mai visto: nessun pagamento generato`,
        })
        continue
    }
    if (importo <= 0) continue // quota 0: pagamenti_importo_positivo lo rifiuterebbe
    pagamenti.push({
      personaChiave,
      stagioneVecchiaId: d.stagione_id,
      importo,
      data: d.updated_at.slice(0, 10),
    })
  }
  return { pagamenti, anomalie }
}
```

- [ ] **Step 4: Verificare il verde**

Run: `npm run test:unit -- migrazione-trasforma && npm run type-check`
Expected: tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrazione/trasforma.ts tests/unit/migrazione-trasforma.test.ts
git commit -m "feat(migrazione): tesseramenti fusi, visita e pagamenti ricostruiti"
```

---

## Task 4: Presenze raggruppate in sedute

**Files:**
- Modify: `scripts/migrazione/trasforma.ts`
- Modify: `tests/unit/migrazione-trasforma.test.ts`

**Interfaces:**
- Consumes: tipi del Task 1.
- Produces:
  - `type NuovaSeduta = { squadraVecchiaId: string; stagioneVecchiaId: string; data: string; presenze: { personaChiave: string; stato: 'presente' | 'assente'; note: string | null }[] }`
  - `raggruppaPresenze(presenze: VecchiaPresenza[], tesseratiPerId: Map<string, string>, stagionePerSquadraVecchia: Map<string, string>): { sedute: NuovaSeduta[]; scartateNonAllenamento: number; anomalie: Anomalia[] }` — `stagionePerSquadraVecchia` mappa id squadra vecchia → id stagione vecchia (dalle squadre migrate)

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/unit/migrazione-trasforma.test.ts`, aggiungi:

```ts
import { raggruppaPresenze } from '@/scripts/migrazione/trasforma'

const PRESENZA = {
  id: 'p-1',
  tesserato_id: 't-1',
  squadra_id: 'sq-1',
  stagione_id: 'st-1',
  data: '2024-10-07',
  tipo: 'allenamento',
  presente: true,
  note: null,
}
const STAGIONE_PER_SQUADRA = new Map([['sq-1', 'st-1']])

describe('raggruppaPresenze', () => {
  it('stessa squadra e stessa data diventano una seduta con le sue presenze', () => {
    const seconda = { ...PRESENZA, id: 'p-2', tesserato_id: 't-1b', presente: false }
    const perId = new Map([['t-1', 'cf:A'], ['t-1b', 'cf:B']])
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA, seconda], perId, STAGIONE_PER_SQUADRA)
    expect(anomalie).toEqual([])
    expect(sedute).toEqual([{
      squadraVecchiaId: 'sq-1',
      stagioneVecchiaId: 'st-1',
      data: '2024-10-07',
      presenze: [
        { personaChiave: 'cf:A', stato: 'presente', note: null },
        { personaChiave: 'cf:B', stato: 'assente', note: null },
      ],
    }])
  })

  it('date diverse danno sedute diverse', () => {
    const altra = { ...PRESENZA, id: 'p-2', data: '2024-10-09' }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute } = raggruppaPresenze([PRESENZA, altra], perId, STAGIONE_PER_SQUADRA)
    expect(sedute).toHaveLength(2)
  })

  it('partite, tornei ed eventi sono scartati e contati, senza anomalia', () => {
    const partita = { ...PRESENZA, id: 'p-2', tipo: 'partita' }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, scartateNonAllenamento } = raggruppaPresenze(
      [PRESENZA, partita], perId, STAGIONE_PER_SQUADRA,
    )
    expect(sedute).toHaveLength(1)
    expect(scartateNonAllenamento).toBe(1)
  })

  it('una presenza senza squadra è anomalia: non esiste seduta a cui darla', () => {
    const orfana = { ...PRESENZA, id: 'p-3', squadra_id: null }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, anomalie } = raggruppaPresenze([orfana], perId, STAGIONE_PER_SQUADRA)
    expect(sedute).toEqual([])
    expect(anomalie[0].tipo).toBe('presenza_senza_squadra')
  })

  it('una presenza la cui squadra non è migrata è anomalia', () => {
    const perId = new Map([['t-1', 'cf:A']])
    const { anomalie } = raggruppaPresenze([PRESENZA], perId, new Map())
    expect(anomalie[0].tipo).toBe('presenza_squadra_non_migrata')
  })

  it('duplicati stesso tesserato/seduta: vince la prima riga, la seconda è anomalia', () => {
    const doppione = { ...PRESENZA, id: 'p-2', presente: false }
    const perId = new Map([['t-1', 'cf:A']])
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA, doppione], perId, STAGIONE_PER_SQUADRA)
    expect(sedute[0].presenze).toHaveLength(1)
    expect(sedute[0].presenze[0].stato).toBe('presente')
    expect(anomalie[0].tipo).toBe('presenza_duplicata')
  })

  it('presenze di tesserati non migrati sono ignorate: hanno già la loro anomalia', () => {
    const { sedute, anomalie } = raggruppaPresenze([PRESENZA], new Map(), STAGIONE_PER_SQUADRA)
    expect(sedute).toEqual([])
    expect(anomalie).toEqual([])
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- migrazione-trasforma`
Expected: FAIL su `raggruppaPresenze`.

- [ ] **Step 3: Implementare**

In `scripts/migrazione/trasforma.ts`, aggiungi:

```ts
import type { VecchiaPresenza } from './tipi'

export type NuovaSeduta = {
  squadraVecchiaId: string
  stagioneVecchiaId: string
  data: string
  presenze: { personaChiave: string; stato: 'presente' | 'assente'; note: string | null }[]
}

/**
 * Il vecchio schema ha presenze sciolte; il nuovo ha la seduta come entità.
 * (squadra, data) → una seduta. La stagione arriva dalla squadra migrata,
 * non dalla stagione_id della presenza, che è nullable e a volte manca.
 */
export function raggruppaPresenze(
  presenze: VecchiaPresenza[],
  tesseratiPerId: Map<string, string>,
  stagionePerSquadraVecchia: Map<string, string>,
): { sedute: NuovaSeduta[]; scartateNonAllenamento: number; anomalie: Anomalia[] } {
  const anomalie: Anomalia[] = []
  let scartateNonAllenamento = 0
  const perSeduta = new Map<string, NuovaSeduta>()

  for (const p of presenze) {
    if (p.tipo !== 'allenamento') {
      scartateNonAllenamento += 1
      continue
    }
    const personaChiave = tesseratiPerId.get(p.tesserato_id)
    if (!personaChiave) continue // tesserato già anomalo o scartato altrove
    if (!p.squadra_id) {
      anomalie.push({
        tipo: 'presenza_senza_squadra',
        id: p.id,
        chiave: `${personaChiave} @ ${p.data}`,
        dettaglio: 'presenza di allenamento senza squadra: nessuna seduta possibile, sistemare o accettare la perdita',
      })
      continue
    }
    const stagioneVecchiaId = stagionePerSquadraVecchia.get(p.squadra_id)
    if (!stagioneVecchiaId) {
      anomalie.push({
        tipo: 'presenza_squadra_non_migrata',
        id: p.id,
        chiave: `${personaChiave} @ ${p.data}`,
        dettaglio: `la squadra '${p.squadra_id}' non è fra quelle migrate`,
      })
      continue
    }

    const chiaveSeduta = `${p.squadra_id}|${p.data}`
    let seduta = perSeduta.get(chiaveSeduta)
    if (!seduta) {
      seduta = { squadraVecchiaId: p.squadra_id, stagioneVecchiaId, data: p.data, presenze: [] }
      perSeduta.set(chiaveSeduta, seduta)
    }
    if (seduta.presenze.some((r) => r.personaChiave === personaChiave)) {
      anomalie.push({
        tipo: 'presenza_duplicata',
        id: p.id,
        chiave: `${personaChiave} @ ${p.data}`,
        dettaglio: 'due righe per lo stesso tesserato nella stessa seduta: tenuta la prima',
      })
      continue
    }
    seduta.presenze.push({
      personaChiave,
      stato: p.presente ? 'presente' : 'assente',
      note: p.note,
    })
  }

  return { sedute: [...perSeduta.values()], scartateNonAllenamento, anomalie }
}
```

- [ ] **Step 4: Verificare il verde**

Run: `npm run test:unit -- migrazione-trasforma && npm run type-check`
Expected: tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrazione/trasforma.ts tests/unit/migrazione-trasforma.test.ts
git commit -m "feat(migrazione): presenze sciolte raggruppate in sedute"
```

---

## Task 5: Il report

**Files:**
- Create: `scripts/migrazione/report.ts`
- Create: `tests/unit/migrazione-report.test.ts`

**Interfaces:**
- Consumes: `Anomalia` dal Task 1.
- Produces:
  - `type ContoTabella = { lette: number; migrate: number; giaPresenti: number; scartate: number; motivoScarti?: string }`
  - `type DatiReport = { dryRun: boolean; conteggi: Record<string, ContoTabella>; anomalie: Anomalia[]; account: { email: string; password: string }[] }`
  - `generaReport(dati: DatiReport): string`

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `tests/unit/migrazione-report.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { generaReport } from '@/scripts/migrazione/report'

const BASE = {
  dryRun: true,
  conteggi: {
    stagioni: { lette: 3, migrate: 2, giaPresenti: 1, scartate: 0 },
    presenze: { lette: 900, migrate: 850, giaPresenti: 0, scartate: 50, motivoScarti: 'tipo diverso da allenamento' },
  },
  anomalie: [
    { tipo: 'visita_senza_scadenza', id: 'tds-9', chiave: 'cf:X @ stagione st-1', dettaglio: 'senza scadenza' },
  ],
  account: [],
}

describe('generaReport', () => {
  it('dichiara in testa che è un dry-run', () => {
    const report = generaReport(BASE)
    expect(report).toMatch(/dry-run/i)
    expect(report).toMatch(/nessuna scrittura/i)
  })

  it('ha una riga per tabella con tutti i conteggi', () => {
    const report = generaReport(BASE)
    expect(report).toContain('| stagioni | 3 | 2 | 1 | 0 |')
    expect(report).toContain('| presenze | 900 | 850 | 0 | 50 |')
    expect(report).toContain('tipo diverso da allenamento')
  })

  it('elenca le anomalie con tipo, id e chiave', () => {
    const report = generaReport(BASE)
    expect(report).toContain('visita_senza_scadenza')
    expect(report).toContain('tds-9')
    expect(report).toContain('cf:X @ stagione st-1')
  })

  it('senza anomalie lo dice, invece di lasciare una sezione vuota', () => {
    const report = generaReport({ ...BASE, anomalie: [] })
    expect(report).toMatch(/nessuna anomalia/i)
  })

  it('con --esegui elenca gli account creati con la password', () => {
    const report = generaReport({
      ...BASE,
      dryRun: false,
      account: [{ email: 'mister@vecchio.test', password: 'luca_VIRPOL_1234' }],
    })
    expect(report).not.toMatch(/dry-run/i)
    expect(report).toContain('mister@vecchio.test')
    expect(report).toContain('luca_VIRPOL_1234')
    expect(report).toMatch(/a voce/i)
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- migrazione-report`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Implementare**

Crea `scripts/migrazione/report.ts`:

```ts
import type { Anomalia } from './tipi'

export type ContoTabella = {
  lette: number
  migrate: number
  giaPresenti: number
  scartate: number
  motivoScarti?: string
}

export type DatiReport = {
  dryRun: boolean
  conteggi: Record<string, ContoTabella>
  anomalie: Anomalia[]
  account: { email: string; password: string }[]
}

/**
 * Il report è l'output principale dello script: si legge PRIMA di decidere
 * di eseguire. Markdown perché si legge nell'editor e si allega com'è.
 */
export function generaReport(dati: DatiReport): string {
  const righe: string[] = []
  righe.push('# Report di migrazione')
  righe.push('')
  righe.push(
    dati.dryRun
      ? '**Dry-run: nessuna scrittura eseguita.** Questo report descrive cosa farebbe `--esegui`.'
      : `**Eseguita** il ${new Date().toISOString()}.`,
  )
  righe.push('')

  righe.push('## Conteggi')
  righe.push('')
  righe.push('| tabella | lette | da migrare | già presenti | scartate | motivo scarti |')
  righe.push('|---|---|---|---|---|---|')
  for (const [tabella, c] of Object.entries(dati.conteggi)) {
    righe.push(
      `| ${tabella} | ${c.lette} | ${c.migrate} | ${c.giaPresenti} | ${c.scartate} | ${c.motivoScarti ?? ''} |`,
    )
  }
  righe.push('')

  righe.push('## Anomalie')
  righe.push('')
  if (dati.anomalie.length === 0) {
    righe.push('Nessuna anomalia.')
  } else {
    righe.push('Da decidere caso per caso nel vecchio sistema. Lo script non ripara mai.')
    righe.push('')
    righe.push('| tipo | id vecchio | chiave | dettaglio |')
    righe.push('|---|---|---|---|')
    for (const a of dati.anomalie) {
      righe.push(`| ${a.tipo} | ${a.id} | ${a.chiave} | ${a.dettaglio} |`)
    }
  }
  righe.push('')

  if (dati.account.length > 0) {
    righe.push('## Account creati')
    righe.push('')
    righe.push('Password iniziali da comunicare **a voce**, mai per iscritto.')
    righe.push('')
    righe.push('| email | password iniziale |')
    righe.push('|---|---|')
    for (const a of dati.account) {
      righe.push(`| ${a.email} | ${a.password} |`)
    }
    righe.push('')
  }

  return righe.join('\n')
}
```

- [ ] **Step 4: Verificare il verde**

Run: `npm run test:unit -- migrazione-report && npm run type-check`
Expected: 5 test verdi.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrazione/report.ts tests/unit/migrazione-report.test.ts
git commit -m "feat(migrazione): il report che si legge prima di dare l'ok"
```

---

## Task 6: Lettura dal vecchio, orchestratore e prova sul campo

**Files:**
- Create: `scripts/migrazione/vecchio.ts`
- Create: `scripts/migra.ts`
- Modify: `.env.example`
- Modify: `package.json` (script `migra`)
- Modify: `CLAUDE.md` (stato fase 6, comandi)

**Interfaces:**
- Consumes: tutto ciò che i task 1–5 producono, `supabaseAdmin` da `@/lib/supabase/admin`, `passwordIniziale` da `@/lib/domain/password`.
- Produces: `npm run migra -- --quota 2024-25=350 ...` (dry-run) e `npm run migra -- --esegui --quota ...`.

- [ ] **Step 1: Il lettore del progetto vecchio**

Crea `scripts/migrazione/vecchio.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const schema = z.object({
  VECCHIO_SUPABASE_URL: z.string().url(),
  VECCHIO_SERVICE_ROLE_KEY: z.string().min(1),
})

/**
 * Client del progetto VECCHIO, solo lettura per contratto: questo modulo non
 * espone il client, espone `leggiTutto`, e `leggiTutto` fa solo select.
 * Nessun tipo generato: lo schema vecchio non ha types nel repo nuovo, le
 * forme sono dichiarate a mano in tipi.ts e validate dall'uso.
 */
function clientVecchio() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    throw new Error(
      'VECCHIO_SUPABASE_URL o VECCHIO_SERVICE_ROLE_KEY assenti: vanno in .env.local, mai committate.',
    )
  }
  return createClient(esito.data.VECCHIO_SUPABASE_URL, esito.data.VECCHIO_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

const PAGINA = 1000

/** Legge una tabella intera, paginando: PostgREST tronca a 1000 righe. */
export async function leggiTutto<T>(tabella: string, colonne: string): Promise<T[]> {
  const db = clientVecchio()
  const righe: T[] = []
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db.from(tabella).select(colonne).range(da, da + PAGINA - 1)
    if (error) throw new Error(`lettura di ${tabella} fallita: ${error.message}`)
    righe.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return righe
}
```

- [ ] **Step 2: L'orchestratore**

Crea `scripts/migra.ts`:

```ts
/**
 * Migrazione dei dati dal progetto vecchio al nuovo.
 *
 * Dry-run per default: legge, trasforma, scrive il report, non tocca il
 * database. Scrive solo con --esegui. Idempotente per chiavi naturali: ciò
 * che esiste già nel target si salta, mai si sovrascrive.
 *
 * Uso:
 *   npm run migra -- --quota 2024-25=350 --quota 2025-26=380
 *   npm run migra -- --esegui --quota 2024-25=350 --quota 2025-26=380
 *
 * Vedi docs/superpowers/specs/2026-08-09-migrazione-dati-design.md.
 */
import { writeFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { parseArgs } from 'node:util'
import { passwordIniziale } from '@/lib/domain/password'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generaReport, type ContoTabella, type DatiReport } from '@/scripts/migrazione/report'
import {
  analizzaQuote,
  chiaveCognomeNome,
  fondiTesseramenti,
  NOTA_RICOSTRUITO,
  raggruppaPresenze,
  ricostruisciPagamenti,
  trasformaStaff,
  trasformaStagione,
  trasformaTesserati,
} from '@/scripts/migrazione/trasforma'
import type {
  Anomalia,
  VecchiaPresenza,
  VecchiaSquadra,
  VecchiaStagione,
  VecchiDatiStagionali,
  VecchioTesseramentoSquadra,
  VecchioTesserato,
  VecchioUtente,
} from '@/scripts/migrazione/tipi'
import { leggiTutto } from '@/scripts/migrazione/vecchio'

try { loadEnvFile('.env.local') } catch { /* variabili già nell'ambiente */ }

const PERCORSO_REPORT = 'scripts/report-migrazione.md'

async function main() {
  const { values } = parseArgs({
    options: {
      esegui: { type: 'boolean', default: false },
      quota: { type: 'string', multiple: true, default: [] },
    },
  })
  const dryRun = !values.esegui
  const quotePerCodice = analizzaQuote(values.quota ?? [])

  const db = supabaseAdmin()
  const conteggi: Record<string, ContoTabella> = {}
  const anomalie: Anomalia[] = []
  const accountCreati: { email: string; password: string }[] = []

  // ---- Lettura completa dal vecchio --------------------------------------
  const vStagioni = await leggiTutto<VecchiaStagione>(
    'stagioni_sportive', 'id, nome, data_inizio, data_fine, archiviata')
  const vUtenti = await leggiTutto<VecchioUtente>(
    'users', 'id, email, role, roles, nome, cognome, telefono')
  const vTesserati = await leggiTutto<VecchioTesserato>(
    'tesserati', 'id, nome, cognome, data_nascita, codice_fiscale, email, telefono, indirizzo, citta, cap')
  const vSquadre = await leggiTutto<VecchiaSquadra>(
    'squadre', 'id, nome, categoria, annata, stagione_id')
  const vRigheSquadra = await leggiTutto<VecchioTesseramentoSquadra>(
    'tesserati_squadre_stagioni', 'id, tesserato_id, squadra_id, stagione_id, numero_maglia, data_tesseramento, note')
  const vDati = await leggiTutto<VecchiDatiStagionali>(
    'tesserati_dati_stagionali', 'id, tesserato_id, stagione_id, stato_pagamento, note_pagamento, visita_sportiva, scadenza_certificato, updated_at')
  const vPresenze = await leggiTutto<VecchiaPresenza>(
    'presenze', 'id, tesserato_id, squadra_id, stagione_id, data, tipo, presente, note')

  // ---- Stagioni -----------------------------------------------------------
  const codicePerStagioneVecchia = new Map<string, string>()
  const stagioniDaScrivere: { codice: string; etichetta: string; data_inizio: string; data_fine: string; stato: 'aperta' | 'chiusa' }[] = []
  for (const v of vStagioni) {
    const esito = trasformaStagione(v)
    if (!esito.ok) { anomalie.push(esito.anomalia); continue }
    codicePerStagioneVecchia.set(v.id, esito.stagione.codice)
    stagioniDaScrivere.push(esito.stagione)
  }

  // Le quote vanno date per ogni stagione trovata nei dati: fermarsi PRIMA
  // di qualunque scrittura, non a metà.
  const codiciSenzaQuota = stagioniDaScrivere
    .map((s) => s.codice)
    .filter((codice) => !quotePerCodice.has(codice))
  if (codiciSenzaQuota.length > 0) {
    throw new Error(
      `quota mancante per: ${codiciSenzaQuota.join(', ')}. Passala con --quota CODICE=IMPORTO.`,
    )
  }
  const quotaPerStagioneVecchia = new Map(
    [...codicePerStagioneVecchia].map(([idVecchio, codice]) => [idVecchio, quotePerCodice.get(codice)!]),
  )

  // ---- Trasformazioni pure ------------------------------------------------
  const { persone, anomalie: aTesserati } = trasformaTesserati(vTesserati)
  anomalie.push(...aTesserati)

  // La stessa funzione chiave usata in trasformaTesserati: una sola
  // definizione. I tesserati con terna duplicata non stanno in
  // personaPerChiave, quindi restano fuori dalla mappa — come vogliono i
  // test dei task 3 e 4.
  const personaPerChiave = new Map(persone.map((p) => [p.chiave, p]))
  const tesseratiPerId = new Map<string, string>()
  for (const t of vTesserati) {
    const chiave = chiavePersona(t)
    if (personaPerChiave.has(chiave)) tesseratiPerId.set(t.id, chiave)
  }

  const personePerCognomeNome = new Map<string, string>()
  for (const p of persone) {
    personePerCognomeNome.set(chiaveCognomeNome(p.cognome, p.nome), p.chiave)
  }
  const { account, scartati: staffScartati, anomalie: aStaff } = trasformaStaff(
    vUtenti, personePerCognomeNome)
  anomalie.push(...aStaff)

  const squadreValide = vSquadre.filter((s) => {
    if (s.stagione_id && codicePerStagioneVecchia.has(s.stagione_id)) return true
    anomalie.push({
      tipo: 'squadra_senza_stagione',
      id: s.id,
      chiave: s.nome,
      dettaglio: 'squadra senza stagione (o con stagione anomala): non migra',
    })
    return false
  })
  const stagionePerSquadraVecchia = new Map(squadreValide.map((s) => [s.id, s.stagione_id!]))

  const { tesseramenti, anomalie: aTess } = fondiTesseramenti(vRigheSquadra, vDati, tesseratiPerId)
  anomalie.push(...aTess)
  const { pagamenti, anomalie: aPag } = ricostruisciPagamenti(vDati, tesseratiPerId, quotaPerStagioneVecchia)
  anomalie.push(...aPag)
  const { sedute, scartateNonAllenamento, anomalie: aPres } = raggruppaPresenze(
    vPresenze, tesseratiPerId, stagionePerSquadraVecchia)
  anomalie.push(...aPres)

  // ---- Stato attuale del target, per l'idempotenza ------------------------
  const { data: stagioniEsistenti } = await db.from('stagioni').select('id, codice')
  const { data: personeEsistenti } = await db.from('persone')
    .select('id, codice_fiscale, cognome, nome, data_nascita')
  const { data: squadreEsistenti } = await db.from('squadre').select('id, stagione_id, nome')
  const { data: tessEsistenti } = await db.from('tesseramenti').select('id, persona_id, stagione_id')
  const { data: quoteEsistenti } = await db.from('quote_importi').select('stagione_id')
  const { data: seduteEsistenti } = await db.from('sedute_allenamento')
    .select('id, squadra_id, data, ora_inizio')

  // ---- Scritture (o conteggio, in dry-run) --------------------------------
  // Ogni blocco segue lo stesso schema: indice delle chiavi già nel target,
  // divisione nuove/già presenti, conteggio, insert solo con --esegui. In
  // dry-run le mappe di id si riempiono con id fittizi 'dry:<chiave>' così i
  // blocchi a valle contano comunque il giusto.

  // Stagioni.
  const stagioneIdPerCodice = new Map((stagioniEsistenti ?? []).map((s) => [s.codice, s.id]))
  const stagioniNuove = stagioniDaScrivere.filter((s) => !stagioneIdPerCodice.has(s.codice))
  conteggi['stagioni'] = {
    lette: vStagioni.length,
    migrate: stagioniNuove.length,
    giaPresenti: stagioniDaScrivere.length - stagioniNuove.length,
    scartate: vStagioni.length - stagioniDaScrivere.length,
    motivoScarti: 'nome non riconducibile a un codice',
  }
  for (const s of stagioniNuove) {
    if (dryRun) { stagioneIdPerCodice.set(s.codice, `dry:${s.codice}`); continue }
    const { data, error } = await db.from('stagioni').insert(s).select('id').single()
    if (error) throw new Error(`insert stagione ${s.codice}: ${error.message}`)
    stagioneIdPerCodice.set(s.codice, data.id)
  }
  const stagioneIdPerVecchia = new Map(
    [...codicePerStagioneVecchia].map(([vecchioId, codice]) => [vecchioId, stagioneIdPerCodice.get(codice)!]),
  )

  // Quote per stagione.
  const stagioniConQuota = new Set((quoteEsistenti ?? []).map((q) => q.stagione_id))
  let quoteNuove = 0
  let quotePresenti = 0
  for (const s of stagioniDaScrivere) {
    const stagioneId = stagioneIdPerCodice.get(s.codice)!
    if (stagioniConQuota.has(stagioneId)) { quotePresenti += 1; continue }
    quoteNuove += 1
    if (dryRun) continue
    const { error } = await db.from('quote_importi').insert({
      stagione_id: stagioneId,
      importo: quotePerCodice.get(s.codice)!,
      note: NOTA_RICOSTRUITO,
    })
    if (error) throw new Error(`insert quota ${s.codice}: ${error.message}`)
  }
  conteggi['quote_importi'] = {
    lette: stagioniDaScrivere.length, migrate: quoteNuove, giaPresenti: quotePresenti, scartate: 0,
  }

  // Persone. L'indice dell'esistente usa la stessa chiavePersona.
  const personaIdPerChiave = new Map(
    (personeEsistenti ?? []).map((p) => [chiavePersona(p), p.id]),
  )
  const personeNuove = persone.filter((p) => !personaIdPerChiave.has(p.chiave))
  conteggi['persone (tesserati)'] = {
    lette: vTesserati.length,
    migrate: personeNuove.length,
    giaPresenti: persone.length - personeNuove.length,
    scartate: vTesserati.length - persone.length,
    motivoScarti: 'terna duplicata: vedi anomalie',
  }
  for (const p of personeNuove) {
    if (dryRun) { personaIdPerChiave.set(p.chiave, `dry:${p.chiave}`); continue }
    const { chiave, ...riga } = p
    const { data, error } = await db.from('persone').insert(riga).select('id').single()
    if (error) throw new Error(`insert persona ${chiave}: ${error.message}`)
    personaIdPerChiave.set(chiave, data.id)
  }

  // Account staff: auth.users + profili, con compensazione come in
  // app/(app)/admin/utenti/actions.ts. Un fallimento è un'anomalia, non un
  // crash: gli altri account devono comunque nascere.
  const { data: authEsistenti, error: eAuth } = await db.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })
  if (eAuth) throw new Error(`lettura auth.users del target: ${eAuth.message}`)
  const emailEsistenti = new Set(
    authEsistenti.users.map((u) => u.email?.toLowerCase()).filter(Boolean),
  )
  let accountNuovi = 0
  let accountPresenti = 0
  let accountFalliti = 0
  for (const a of account) {
    if (emailEsistenti.has(a.email)) { accountPresenti += 1; continue }
    accountNuovi += 1
    if (dryRun) continue
    const password = passwordIniziale(a.nomePerPassword)
    const { data: creato, error } = await db.auth.admin.createUser({
      email: a.email,
      password,
      email_confirm: true,
    })
    if (error) {
      accountFalliti += 1
      anomalie.push({
        tipo: 'account_non_creato', id: a.email, chiave: a.email,
        dettaglio: `auth.createUser: ${error.message}`,
      })
      continue
    }
    const { error: eProfilo } = await db.from('profili').insert({
      id: creato.user.id,
      ruolo: a.ruolo,
      persona_id: a.personaChiave ? (personaIdPerChiave.get(a.personaChiave) ?? null) : null,
    })
    if (eProfilo) {
      await db.auth.admin.deleteUser(creato.user.id).catch(() => {})
      accountFalliti += 1
      anomalie.push({
        tipo: 'account_non_creato', id: a.email, chiave: a.email,
        dettaglio: `insert profilo: ${eProfilo.message}`,
      })
      continue
    }
    accountCreati.push({ email: a.email, password })
  }
  conteggi['account staff'] = {
    lette: vUtenti.length,
    migrate: accountNuovi - accountFalliti,
    giaPresenti: accountPresenti,
    scartate: staffScartati + accountFalliti,
    motivoScarti: 'tesserato/genitore, o creazione fallita (vedi anomalie)',
  }

  // Squadre.
  const squadraIdPerChiave = new Map(
    (squadreEsistenti ?? []).map((s) => [`${s.stagione_id}|${s.nome}`, s.id]),
  )
  const squadraIdPerVecchia = new Map<string, string>()
  let squadreNuove = 0
  let squadrePresenti = 0
  for (const s of squadreValide) {
    const stagioneId = stagioneIdPerVecchia.get(s.stagione_id!)!
    const chiave = `${stagioneId}|${s.nome}`
    const esistente = squadraIdPerChiave.get(chiave)
    if (esistente) {
      squadraIdPerVecchia.set(s.id, esistente)
      squadrePresenti += 1
      continue
    }
    squadreNuove += 1
    if (dryRun) { squadraIdPerVecchia.set(s.id, `dry:${chiave}`); continue }
    const { data, error } = await db.from('squadre').insert({
      stagione_id: stagioneId, nome: s.nome, categoria: s.categoria, annata: s.annata,
    }).select('id').single()
    if (error) throw new Error(`insert squadra ${s.nome}: ${error.message}`)
    squadraIdPerVecchia.set(s.id, data.id)
    squadraIdPerChiave.set(chiave, data.id)
  }
  conteggi['squadre'] = {
    lette: vSquadre.length,
    migrate: squadreNuove,
    giaPresenti: squadrePresenti,
    scartate: vSquadre.length - squadreValide.length,
    motivoScarti: 'senza stagione: vedi anomalie',
  }

  // Tesseramenti. Chiave: persona + stagione (id del target).
  const tessEsistentiChiavi = new Set(
    (tessEsistenti ?? []).map((t) => `${t.persona_id}|${t.stagione_id}`),
  )
  const tesseramentoIdPerChiave = new Map<string, string>()
  const tesseramentiCreati = new Set<string>()
  let tessNuovi = 0
  let tessPresenti = 0
  let tessScartati = 0
  for (const t of tesseramenti) {
    const personaId = personaIdPerChiave.get(t.personaChiave)
    const stagioneId = stagioneIdPerVecchia.get(t.stagioneVecchiaId)
    if (!personaId || !stagioneId) { tessScartati += 1; continue } // persona o stagione già anomala
    const chiave = `${t.personaChiave}|${t.stagioneVecchiaId}`
    if (tessEsistentiChiavi.has(`${personaId}|${stagioneId}`)) { tessPresenti += 1; continue }
    tessNuovi += 1
    tesseramentiCreati.add(chiave)
    if (dryRun) { tesseramentoIdPerChiave.set(chiave, `dry:${chiave}`); continue }
    const { data, error } = await db.from('tesseramenti').insert({
      persona_id: personaId,
      stagione_id: stagioneId,
      squadra_id: t.squadraVecchiaId ? (squadraIdPerVecchia.get(t.squadraVecchiaId) ?? null) : null,
      numero_maglia: t.numero_maglia,
      visita_scadenza: t.visita_scadenza,
      note: t.note,
    }).select('id').single()
    if (error) throw new Error(`insert tesseramento ${chiave}: ${error.message}`)
    tesseramentoIdPerChiave.set(chiave, data.id)
  }
  conteggi['tesseramenti'] = {
    lette: vRigheSquadra.length,
    migrate: tessNuovi,
    giaPresenti: tessPresenti,
    scartate: tessScartati,
    motivoScarti: 'persona o stagione non migrata',
  }

  // Pagamenti ricostruiti: SOLO per tesseramenti creati in questo run. Un
  // tesseramento già presente può avere pagamenti veri registrati a mano.
  let pagNuovi = 0
  let pagSaltati = 0
  for (const p of pagamenti) {
    const chiave = `${p.personaChiave}|${p.stagioneVecchiaId}`
    if (!tesseramentiCreati.has(chiave)) { pagSaltati += 1; continue }
    pagNuovi += 1
    if (dryRun) continue
    const { error } = await db.from('pagamenti_quota').insert({
      tesseramento_id: tesseramentoIdPerChiave.get(chiave)!,
      importo: p.importo,
      data: p.data,
      metodo: 'contanti',
      note: NOTA_RICOSTRUITO,
    })
    if (error) throw new Error(`insert pagamento ${chiave}: ${error.message}`)
  }
  conteggi['pagamenti_quota'] = {
    lette: vDati.length,
    migrate: pagNuovi,
    giaPresenti: 0,
    scartate: pagSaltati,
    motivoScarti: 'stato senza importo, o tesseramento non creato in questo run',
  }

  // Sedute. Chiave: squadra + data, con ora_inizio nulla (le sedute migrate
  // non hanno orario).
  const seduteEsistentiChiavi = new Map(
    (seduteEsistenti ?? [])
      .filter((s) => s.ora_inizio === null)
      .map((s) => [`${s.squadra_id}|${s.data}`, s.id]),
  )
  const sedutaIdPerChiave = new Map<string, string>()
  let seduteNuove = 0
  let sedutePresenti = 0
  for (const s of sedute) {
    const squadraId = squadraIdPerVecchia.get(s.squadraVecchiaId)
    if (!squadraId) continue // squadra già anomala: le sue presenze sono già contate
    const chiave = `${squadraId}|${s.data}`
    const esistente = seduteEsistentiChiavi.get(chiave)
    if (esistente) {
      sedutaIdPerChiave.set(chiave, esistente)
      sedutePresenti += 1
      continue
    }
    seduteNuove += 1
    if (dryRun) { sedutaIdPerChiave.set(chiave, `dry:${chiave}`); continue }
    const { data, error } = await db.from('sedute_allenamento').insert({
      squadra_id: squadraId,
      stagione_id: stagioneIdPerVecchia.get(s.stagioneVecchiaId)!,
      data: s.data,
      ora_inizio: null,
    }).select('id').single()
    if (error) throw new Error(`insert seduta ${chiave}: ${error.message}`)
    sedutaIdPerChiave.set(chiave, data.id)
  }
  conteggi['sedute_allenamento'] = {
    lette: sedute.length, migrate: seduteNuove, giaPresenti: sedutePresenti, scartate: 0,
  }

  // Presenze: per seduta, una insert di array. Ogni riga solo se il
  // tesseramento migrato della persona in quella stagione è sulla stessa
  // squadra della seduta: le FK composite del target rifiuterebbero il
  // resto — meglio contarlo che farlo esplodere.
  let presNuove = 0
  let presPresenti = 0
  let presScartate = 0
  for (const s of sedute) {
    const squadraId = squadraIdPerVecchia.get(s.squadraVecchiaId)
    if (!squadraId) { presScartate += s.presenze.length; continue }
    const chiaveSeduta = `${squadraId}|${s.data}`
    const sedutaId = sedutaIdPerChiave.get(chiaveSeduta)!
    const sedutaGiaPresente = seduteEsistentiChiavi.has(chiaveSeduta)
    if (sedutaGiaPresente) {
      // Seduta già nel target: le sue presenze sono un run precedente.
      presPresenti += s.presenze.length
      continue
    }
    const righe = []
    for (const p of s.presenze) {
      const chiaveTess = `${p.personaChiave}|${s.stagioneVecchiaId}`
      const tessId = tesseramentoIdPerChiave.get(chiaveTess)
      const tessSuQuestaSquadra = tesseramenti.find(
        (t) => t.personaChiave === p.personaChiave
          && t.stagioneVecchiaId === s.stagioneVecchiaId
          && t.squadraVecchiaId === s.squadraVecchiaId,
      )
      if (!tessId || !tessSuQuestaSquadra) { presScartate += 1; continue }
      righe.push({
        seduta_id: sedutaId,
        tesseramento_id: tessId,
        squadra_id: squadraId,
        stato: p.stato,
        note: p.note,
      })
    }
    presNuove += righe.length
    if (dryRun || righe.length === 0) continue
    const { error } = await db.from('presenze').insert(righe)
    if (error) throw new Error(`insert presenze seduta ${chiaveSeduta}: ${error.message}`)
  }
  conteggi['presenze'] = {
    lette: vPresenze.length,
    migrate: presNuove,
    giaPresenti: presPresenti,
    scartate: presScartate + scartateNonAllenamento,
    motivoScarti: 'tipo diverso da allenamento, o tesseramento su altra squadra',
  }

  // ---- Report --------------------------------------------------------------
  const report: DatiReport = { dryRun, conteggi, anomalie, account: accountCreati }
  writeFileSync(PERCORSO_REPORT, generaReport(report))
  console.log(`Report scritto in ${PERCORSO_REPORT}${dryRun ? ' (dry-run, nessuna scrittura)' : ''}`)
}

main().catch((errore) => {
  console.error(errore instanceof Error ? errore.message : errore)
  process.exitCode = 1
})
```

Aggiungi `chiavePersona` all'import da `@/scripts/migrazione/trasforma` (il
blocco import in testa allo scheletro non lo elenca ancora). Se il target ha
più di 1000 utenti auth, `listUsers` va paginato come `leggiTutto` — con i
volumi di questa società non succede, ma se `authEsistenti.users.length ===
1000` fallisci con un errore esplicito invece di procedere con un indice
monco.

- [ ] **Step 3: npm script, env e ignore**

In `package.json`, sotto `seed:dev`:

```json
    "migra": "npx tsx scripts/migra.ts",
```

In `.env.example`, in fondo:

```
# Migrazione: il progetto Supabase VECCHIO, in sola lettura. Vedi
# docs/superpowers/specs/2026-08-09-migrazione-dati-design.md. I valori
# stanno in .env.local e non si committano mai.
VECCHIO_SUPABASE_URL=
VECCHIO_SERVICE_ROLE_KEY=
```

In `.gitignore`, sotto le regole esistenti:

```
# Il report di migrazione contiene nomi veri e password iniziali.
/scripts/report-migrazione.md
```

- [ ] **Step 4: Verifica statica**

Run: `npm run lint && npm run type-check`
Expected: puliti. Lo script sta in `scripts/`, quindi il recinto ESLint della service role non deve scattare.

- [ ] **Step 5: Dry-run contro i dati veri**

Copia le due variabili in `.env.local` (i valori sono in
`~/Progetti/virpolcampogalliano/.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`
→ `VECCHIO_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` →
`VECCHIO_SERVICE_ROLE_KEY`). Poi:

```bash
npm run db:reset
npm run migra -- --quota 2024-25=350 --quota 2025-26=350
```

(se il dry-run si ferma per quote mancanti, aggiungi i codici che elenca:
sono le stagioni vere del vecchio sistema; usa 350 come importo segnaposto
per il dry-run). Expected: `scripts/report-migrazione.md` scritto, exit 0.
**Leggi il report e incolla nel report del task: i conteggi per tabella e
il numero di anomalie per tipo.** Verifica che il DB locale sia rimasto
vuoto: `stagioni`, `persone` e `tesseramenti` a zero righe.

- [ ] **Step 6: Esecuzione vera su DB locale, due volte**

```bash
npm run migra -- --esegui --quota <le stesse quote del dry-run>
npm run migra -- --esegui --quota <le stesse quote del dry-run>
```

Expected, primo run: conteggi «da migrare» > 0, account creati elencati nel
report. Secondo run: **tutte le tabelle con «già presenti» = i numeri del
primo run e «da migrare» = 0, zero scritture**. È il test di idempotenza.
Controlla a campione nel DB locale (Studio o psql): una persona con visita,
una seduta con le sue presenze, un pagamento con `note = 'importo
ricostruito dalla migrazione'`.

- [ ] **Step 7: La suite non è regredita**

```bash
npm run db:reset && npm run test:db && npm run test:unit
npm run seed:dev && npm run test:e2e
```

Expected: tutto verde (lo script non tocca nulla dell'applicazione, ma la
prova costa poco e chiude il task).

- [ ] **Step 8: Documentazione**

In `CLAUDE.md`:
- tabella «Stato»: riga fase 6 → `| 6 | script di migrazione dati e cutover | script fatto e provato in dry-run; cutover dopo la fase 5 |`
- sezione «Comandi»: dopo `seed:dev`, aggiungi la riga `npm run migra -- --quota 2024-25=350   # dry-run; --esegui per scrivere. Vedi la spec di migrazione.`

- [ ] **Step 9: Commit**

```bash
git add scripts/migra.ts scripts/migrazione/vecchio.ts package.json .env.example .gitignore CLAUDE.md
git commit -m "feat(migrazione): lo script completo, dry-run per default"
```

---

## Ordine e dipendenze

```
1 tipi + stagioni/quote   ← indipendente
2 anagrafica e staff      ← richiede 1
3 tesseramenti/pagamenti  ← richiede 1, 2 (chiavePersona)
4 presenze → sedute       ← richiede 1, 2
5 report                  ← richiede 1
6 orchestratore           ← richiede tutti
```

Sequenziali: un implementer alla volta sull'albero.
