# Fondamenta, schema e autenticazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare in piedi il nuovo gestionale fino al punto in cui un admin fa login, crea una stagione sportiva e naviga il backoffice, con lo schema completo e la matrice RLS coperta da test.

**Architecture:** Repo nuovo, Next.js 15 App Router. Le letture stanno nei Server Component, le scritture nelle Server Action; nessuna query Supabase dal browser. Lo schema Postgres è la fonte di verità delle regole di business (view per stato quota, stato visita e percentuali presenze) e le RLS sono la difesa primaria di autorizzazione. Il layer di repository riceve il client Supabase come argomento, così gli stessi test girano impersonando ruoli diversi.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Supabase (Postgres 17+, Auth, `@supabase/ssr`), zod, Vitest, Playwright, Supabase CLI, GitHub Actions.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-29-gestionale-sportivo-rewrite-design.md`. Alla stesura di questo piano lo spec stava nel repo vecchio (`~/Progetti/virpolcampogalliano`); a piano chiuso è stato copiato qui, che ne è ora la copia di riferimento.

**Copertura:** questo piano copre i traguardi **A (fondamenta), B (schema), C (auth e shell)** della §11 dello spec. I traguardi D–K sono oggetto di piani successivi:

| Piano | Traguardi | Contenuto |
|---|---|---|
| 1 — questo | A, B, C | scaffold, CI, schema completo, RLS, login, stagioni |
| 2 | D, E | anagrafica persone, squadre, tesseramenti, incarichi staff, admin/utenti |
| 3 | F | quote, pagamenti, visita medica, cruscotto scadenze |
| 4 | G, H | sedute, foglio presenze, statistiche |
| 5 | I | sito pubblico |
| 6 | J, K | script di migrazione dati e cutover |

## Global Constraints

- **Directory di lavoro:** `~/Progetti/virpolcampogalliano-v2`. Tutti i percorsi in questo piano sono relativi a quella radice. Il repo attuale `~/Progetti/virpolcampogalliano` non va modificato: serve solo come riferimento e come fonte della migrazione dati.
- **Node:** 22.x (l'ambiente ha v22.23.1).
- **Package manager:** npm.
- **Postgres 17 o superiore** obbligatorio. `UNIQUE NULLS NOT DISTINCT` richiederebbe solo 15, ma la revoke del privilegio `MAINTAIN` nella migration delle RLS richiede 17: su 15 quella migration fallisce il parsing dopo che le cinque precedenti sono già passate, lasciando lo schema in piedi con RLS mai abilitata e zero policy.
- **Lingua:** identificatori di dominio, nomi di tabella, colonne, funzioni, variabili e messaggi utente in italiano. Le parole chiave tecniche restano in inglese.
- **Nessun `organization_id`** in nessuna tabella: l'applicazione è a organizzazione singola.
- **Nessun flag `attiva` su `stagioni`:** la stagione corrente è derivata come la prima con `stato = 'aperta'` ordinata per `data_inizio DESC`.
- **`SUPABASE_SERVICE_ROLE_KEY` solo negli script.** `lib/supabase/admin.ts` non è importabile da `app/`, `components/` o `lib/repos/`: una regola ESLint fa fallire la build.
- **Ogni funzione `SECURITY DEFINER` dichiara `set search_path = ''`** e qualifica tutti i nomi (`public.profili`, non `profili`).
- **Le policy RLS di scrittura dichiarano sia `USING` sia `WITH CHECK`.** La condizione "stagione aperta" sta solo sulle policy di scrittura, mai su quelle di lettura.
- **Regole di business non duplicate in TypeScript:** stato quota, stato visita e percentuale presenze esistono solo nelle view SQL.
- **Nessuna pagina sopra le ~150 righe.**
- **Log senza dati personali:** id ed evento, mai nomi, codici fiscali o email.
- **Commit frequenti**, uno per task, in italiano nel corpo e con prefisso convenzionale inglese (`feat:`, `test:`, `chore:`).

---

## File Structure

Cosa esiste alla fine di questo piano, e di cosa risponde ciascun file.

```
package.json                     script: dev, build, type-check, lint,
                                 test:unit, test:db, test:e2e, db:reset, db:types
next.config.ts                   configurazione minima
tsconfig.json                    strict, alias @/*
eslint.config.mjs                flat config + divieto di importare admin.ts
vitest.unit.config.ts            progetto unit (jsdom non serve: solo node)
vitest.db.config.ts              progetto db, fileParallelism: false
playwright.config.ts             E2E su build di produzione locale
instrumentation.ts               valida l'ambiente all'avvio del server
.env.example                     solo segnaposto
.github/workflows/ci.yml         lint, type-check, unit, db, e2e, build

lib/env.ts                       schema zod dell'ambiente applicativo, accesso pigro
lib/db/types.ts                  generato da `supabase gen types typescript --local`
lib/supabase/server.ts           client per Server Component e Server Action
lib/supabase/browser.ts          client per Client Component
lib/supabase/admin.ts            client service role, solo per scripts/
lib/auth/session.ts              getSessione, richiediRuolo, ErroreAutorizzazione
lib/errors/postgres.ts           traduzione dei codici di errore Postgres
lib/azioni.ts                    wrapper delle Server Action -> Risultato<T>
lib/log.ts                       logger minimo senza dati personali
lib/domain/stagione.ts           etichettaDaCodice: funzione pura
lib/repos/stagioni.ts            query e mutazioni sulle stagioni

app/layout.tsx                   html/body, font, stili globali
app/(public)/layout.tsx          header e footer pubblici
app/(public)/page.tsx            home segnaposto (contenuto reale nel piano 5)
app/(auth)/login/page.tsx        form di accesso
app/(auth)/login/actions.ts      Server Action di accesso
app/(auth)/logout/route.ts       POST di uscita
app/(app)/layout.tsx             guard di sessione + shell del backoffice
app/(app)/gestione/page.tsx      redirect alla stagione corrente
app/(app)/[stagione]/layout.tsx  risolve il codice stagione, notFound, sola lettura
app/(app)/[stagione]/page.tsx    cruscotto segnaposto (contenuto reale nel piano 3)
app/(app)/admin/stagioni/page.tsx    elenco stagioni
app/(app)/admin/stagioni/actions.ts  crea, modifica, chiudi, riapri
components/ui/*                  shadcn/ui (button, input, label, select, table…)
components/layout/SelettoreStagione.tsx   Client Component: cambia segmento di URL
components/layout/NavBackoffice.tsx       navigazione del backoffice
middleware.ts                    rinfresca il cookie di sessione, reindirizza al login

supabase/config.toml             generato da `supabase init`
supabase/migrations/
  20260729000100_anagrafica.sql        enum, persone, profili
  20260729000200_stagioni_squadre.sql  stagioni, squadre
  20260729000300_tesseramenti.sql      tesseramenti, incarichi_staff
  20260729000400_quote.sql             quote_importi, pagamenti_quota, v_quote
  20260729000500_presenze.sql          sedute_allenamento, presenze, v_presenze
  20260729000600_rls.sql               schema app, funzioni helper, policy
scripts/env.ts                   ambiente degli script (include la service role)
scripts/seed-dev.ts              utenti e dati minimi per sviluppo ed E2E

tests/db/harness.ts              client pg, isolamento a rollback, impersonazione
tests/db/*.test.ts              vincoli, view, matrice RLS
tests/unit/*.test.ts            env, traduzione errori, helper puri
tests/lint/fixtures/app/…        sorgente di prova per la regola ESLint
tests/lint/regola-admin.test.ts  verifica che la regola scatti
e2e/*.spec.ts                    login, navigazione stagioni, CRUD stagioni
```

---

# Milestone A — Fondamenta

### Task 1: Scaffold del repo e build verde

**Files:**
- Create: l'intero repo `~/Progetti/virpolcampogalliano-v2`
- Create: `.env.example`, `.gitignore`, `next.config.ts`, `tsconfig.json`
- Create: `app/layout.tsx`, `app/(public)/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: niente
- Produces: repo con `npm run build`, `npm run type-check` e `npm run lint` verdi; alias `@/*` verso la radice

- [ ] **Step 1: Creare il progetto**

```bash
cd ~/Progetti
npx create-next-app@latest virpolcampogalliano-v2 \
  --typescript --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-npm --turbopack
cd virpolcampogalliano-v2
```

- [ ] **Step 2: Verificare le versioni installate**

Run: `npm ls next react typescript tailwindcss --depth=0`
Expected: `next@15.x`, `react@19.x`, `typescript@5.x`, `tailwindcss@4.x`. Se `next` non è 15.x, fermarsi e installare esplicitamente: `npm i next@15 react@19 react-dom@19`.

- [ ] **Step 3: Sostituire la home con un segnaposto minimo**

Il contenuto reale del sito pubblico arriva nel piano 5. Qui serve solo una pagina che compili.

`app/(public)/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Virpol Campogalliano</h1>
      <p className="mt-2 text-neutral-600">Sito in ricostruzione.</p>
    </main>
  )
}
```

Cancellare `app/page.tsx` creato dallo scaffold:
```bash
rm app/page.tsx
```

- [ ] **Step 4: Scrivere `.env.example` con soli segnaposto**

```bash
cat > .env.example <<'EOF'
# Applicazione (esposte al browser)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chiave-anon-locale>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Solo per gli script in scripts/ — MAI usata dall'applicazione
SUPABASE_SERVICE_ROLE_KEY=<chiave-service-role-locale>

# Solo per i test sul database
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
EOF
```

- [ ] **Step 5: Aggiungere gli script a `package.json`**

Nella sezione `scripts`, sostituire il blocco con:
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "type-check": "tsc --noEmit",
  "test:unit": "vitest run -c vitest.unit.config.ts",
  "test:db": "vitest run -c vitest.db.config.ts",
  "test:e2e": "playwright test",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local > lib/db/types.ts"
}
```

- [ ] **Step 6: Verificare che il progetto compili**

Run: `npm run build && npm run type-check && npm run lint`
Expected: tutti e tre terminano con codice 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next 15 con TypeScript e Tailwind

Progetto nuovo per la riscrittura del gestionale. Home segnaposto,
.env.example con soli segnaposto, script npm per test e database."
```

---

### Task 2: Validazione dell'ambiente con fallimento all'avvio

**Files:**
- Create: `lib/env.ts`
- Create: `tests/unit/env.test.ts`
- Create: `vitest.unit.config.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts` (valida l'ambiente a build time)

**Interfaces:**
- Consumes: niente
- Produces:
  - `leggiEnv(source: Record<string, string | undefined>): Env` — lancia `Error` con l'elenco delle variabili mancanti
  - `env(): Env` — legge `process.env` una volta e mette in cache
  - `type Env = { NEXT_PUBLIC_SUPABASE_URL: string; NEXT_PUBLIC_SUPABASE_ANON_KEY: string; NEXT_PUBLIC_APP_URL: string }`

- [ ] **Step 1: Installare Vitest e zod**

```bash
npm i zod
npm i -D vitest
```

- [ ] **Step 2: Configurare il progetto di test unitari**

`vitest.unit.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/lint/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
```

- [ ] **Step 3: Scrivere il test che deve fallire**

`tests/unit/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { leggiEnv } from '@/lib/env'

const completo = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chiave',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

describe('leggiEnv', () => {
  it('restituisce le variabili quando sono tutte presenti', () => {
    expect(leggiEnv(completo)).toEqual(completo)
  })

  it('nomina la variabile mancante nel messaggio di errore', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omessa, ...parziale } = completo
    expect(() => leggiEnv(parziale)).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('rifiuta un URL malformato', () => {
    expect(() => leggiEnv({ ...completo, NEXT_PUBLIC_SUPABASE_URL: 'non-un-url' }))
      .toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('non accetta la service role fra le variabili applicative', () => {
    const conServiceRole = { ...completo, SUPABASE_SERVICE_ROLE_KEY: 'segreto' }
    expect(leggiEnv(conServiceRole)).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })
})
```

- [ ] **Step 4: Eseguire il test e verificare che falllisca**

Run: `npm run test:unit`
Expected: FAIL — `Failed to resolve import "@/lib/env"`.

- [ ] **Step 5: Implementare `lib/env.ts`**

```ts
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export type Env = z.infer<typeof schema>

/** Valida un insieme di variabili. Lancia elencando quelle non valide. */
export function leggiEnv(source: Record<string, string | undefined>): Env {
  const esito = schema.safeParse(source)
  if (!esito.success) {
    const problemi = esito.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Configurazione ambiente non valida — ${problemi}`)
  }
  return esito.data
}

let cache: Env | null = null

/**
 * Ambiente applicativo. La lettura è pigra e memorizzata: importare questo
 * modulo non deve mai lanciare, altrimenti i test unitari non possono
 * caricarlo senza un ambiente completo.
 */
export function env(): Env {
  cache ??= leggiEnv(process.env)
  return cache
}
```

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `npm run test:unit`
Expected: PASS, 4 test.

- [ ] **Step 7: Far fallire la build e l'avvio quando l'ambiente è incompleto**

Servono due guardie, perché coprono momenti diversi.

`instrumentation.ts` (Next 15 lo esegue una volta all'avvio del server) è la guardia di runtime:
```ts
import { env } from '@/lib/env'

export function register() {
  env() // lancia se manca una variabile
}
```

Da sola non basta: un `register()` che lancia non termina il processo. Il server resta in ascolto e risponde 500 a ogni richiesta, quindi un deploy passerebbe verde e si romperebbe per gli utenti. La guardia che conta è a build time, ed è anche il posto concettualmente giusto: i valori `NEXT_PUBLIC_*` vengono inlineati nel bundle durante la build, quindi una build con una variabile mancante è già rotta prima di partire.

In `next.config.ts`, aggiungere in cima:
```ts
import { leggiEnv } from './lib/env'

// Import relativo, non `@/`: next.config.ts è caricato fuori dal path
// mapping di tsconfig. Se una variabile manca, la build fallisce qui.
leggiEnv(process.env)
```

- [ ] **Step 8: Verificare i tre stati**

```bash
cp .env.example .env.local
npm run build                      # 1. ambiente completo -> build verde
# togliere la riga NEXT_PUBLIC_SUPABASE_ANON_KEY da .env.local
npm run build                      # 2. -> build FALLISCE nominando la variabile
# rimettere la riga
npm run build                      # 3. -> build verde di nuovo
```
Expected: il caso 2 termina con errore che nomina `NEXT_PUBLIC_SUPABASE_ANON_KEY`; i casi 1 e 3 escono con codice 0. `.env.local` è ignorato da git: non va committato.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: valida l'ambiente all'avvio con zod

leggiEnv riceve le variabili come argomento, così i test non dipendono
da process.env. env() è pigra e memorizzata: importare il modulo non
lancia mai. instrumentation.ts la invoca all'avvio, così una variabile
mancante ferma il server invece di emergere a runtime dentro una query."
```

---

### Task 3: Divieto di importare il client service role, e CI

**Files:**
- Create: `eslint.config.mjs` (sostituisce quello generato dallo scaffold)
- Create: `tests/lint/fixtures/app/importa-admin.tsx`
- Create: `tests/lint/fixtures/lib/repos/importa-admin.ts`, `tests/lint/fixtures/lib/repos/pulito.ts`
- Create: `tests/lint/regola-admin.test.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `tsconfig.json` (esclude il sorgente di prova dal type-check)
- Modify: `package.json` (lo script `lint` esclude il sorgente di prova)

**Interfaces:**
- Consumes: niente
- Produces: `npm run lint` fallisce se `lib/supabase/admin` è importato da `app/`, `components/` o `lib/repos/`

- [ ] **Step 1: Scrivere i sorgenti di prova**

Esistono solo perché la regola sia sotto test. La configurazione ESLint include i loro percorsi fra quelli sorvegliati.

`tests/lint/fixtures/app/importa-admin.tsx` — la forma con alias:
```tsx
// Sorgente di prova: deve violare la regola no-restricted-imports.
// Non fa parte dell'applicazione e non viene compilato da Next.
import { supabaseAdmin } from '@/lib/supabase/admin'

export function Cattivo() {
  return <span>{String(supabaseAdmin)}</span>
}
```

`tests/lint/fixtures/lib/repos/importa-admin.ts` — la forma relativa da dentro `lib/`, che un pattern basato su `group` non intercetterebbe:
```ts
// Sorgente di prova: da lib/repos/ il percorso verso lib/supabase/admin
// non riscrive il segmento `lib`, quindi sfugge a un match sul testo.
import { supabaseAdmin } from '../supabase/admin'

export const cattivo = () => String(supabaseAdmin)
```

`tests/lint/fixtures/lib/repos/pulito.ts` — un file dentro una directory sorvegliata che **non** viola la regola, per distinguere "la regola scatta sul motivo giusto" da "la regola scatta su tutto":
```ts
import { leggiEnv } from '../env'

export const pulito = () => leggiEnv({})
```

- [ ] **Step 2: Scrivere il test che deve fallire**

`tests/lint/regola-admin.test.ts`:
```ts
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Il binario locale, non `npx`: npx risolve il pacchetto a ogni chiamata e
// può toccare la rete. Con quattro casi che avviano un processo ciascuno,
// quel costo manda il file in timeout su un runner lento.
const ESLINT = path.join(process.cwd(), 'node_modules', '.bin', 'eslint')

function eseguiEslint(percorso: string): { codice: number; output: string } {
  try {
    const output = execFileSync(ESLINT, [percorso], { encoding: 'utf8' })
    return { codice: 0, output }
  } catch (e) {
    const errore = e as { status?: number; stdout?: string; stderr?: string }
    return { codice: errore.status ?? 1, output: `${errore.stdout ?? ''}${errore.stderr ?? ''}` }
  }
}

// Ogni caso avvia un processo: il timeout di default a 5s non basta su un
// runner contenduto, e un test flaky su un controllo di sicurezza è peggio
// di nessun test. Il margine è largo perché su questa macchina si è visto un
// picco isolato a 34s, con la suite che normalmente chiude in 5-7s.
// Vitest 4 ha rimosso la forma a oggetto `it(nome, fn, { timeout })`: il
// timeout va passato come numero, terzo argomento di ogni `it`.
const TIMEOUT = 60_000

describe('regola sul client service role', () => {
  it('rifiuta la forma con alias sotto app/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/app/importa-admin.tsx')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT)

  it('rifiuta la forma relativa da dentro lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/importa-admin.ts')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT)

  it('non segnala un file pulito dentro una directory sorvegliata', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/pulito.ts')
    expect(esito.codice).toBe(0)
  }, TIMEOUT)

  it('non segnala nulla su un file fuori dalle directory sorvegliate', () => {
    const esito = eseguiEslint('lib/env.ts')
    expect(esito.codice).toBe(0)
  }, TIMEOUT)
})
```

- [ ] **Step 3: Eseguire il test e verificare che fallisca**

Run: `npm run test:unit -- regola-admin`
Expected: FAIL — il primo test riceve codice 0 perché la regola non esiste ancora (oppure un errore di parsing diverso da "service role").

- [ ] **Step 4: Scrivere la configurazione ESLint**

`eslint.config.mjs`:
```js
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const messaggioAdmin =
  'lib/supabase/admin usa la chiave service role e ignora ogni RLS: ' +
  'può essere importato solo da scripts/.'

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // I percorsi sorvegliati. `tests/lint/fixtures/app/**` è incluso di proposito:
    // tiene la regola stessa sotto test.
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/repos/**/*.ts',
      'tests/lint/fixtures/app/**/*.{ts,tsx}',
      'tests/lint/fixtures/lib/repos/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          // `regex` e non `group`: group confronta il testo letterale del
          // percorso, e da lib/repos/ un import relativo verso
          // lib/supabase/admin non riscrive il segmento `lib`
          // (`../supabase/admin`), quindi sfuggirebbe. Il suffisso li prende
          // tutti: alias, relativo da app/, relativo da dentro lib/.
          regex: '(^|/)supabase/admin$',
          message: messaggioAdmin,
        }],
      }],
    },
  },
  {
    // Il prefisso underscore segnala un parametro o una destrutturazione
    // volutamente non usati: le Server Action ricevono `_precedente` da
    // useActionState e non lo leggono mai.
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'lib/db/types.ts', 'playwright-report/**'],
  },
]
```

- [ ] **Step 5: Escludere il sorgente di prova dal type-check**

`no-restricted-imports` è una regola sintattica: segnala l'import senza risolvere il modulo, quindi `lib/supabase/admin.ts` non deve esistere perché la regola scatti. Deve però esistere per `tsc`, che altrimenti segnala `Cannot find module`. Invece di introdurre un modulo segnaposto che vivrebbe come codice morto fino al Task 10, si esclude il sorgente di prova dal type-check.

In `tsconfig.json`, aggiungere in coda all'oggetto radice:
```json
"exclude": ["node_modules", ".next", "tests/lint/fixtures"]
```

- [ ] **Step 6: Eseguire il test e verificare che passi**

Run: `npm run test:unit -- regola-admin`
Expected: PASS, 2 test.

- [ ] **Step 7: Verificare che il lint del progetto resti verde**

Run: `npm run lint`
Expected: fallisce **solo** su `tests/lint/fixtures/app/importa-admin.tsx`. Aggiungere quel percorso a `.eslintignore` non è corretto — va escluso dallo script di lint del progetto e lasciato al test:

In `package.json` cambiare lo script `lint` in:
```json
"lint": "eslint . --ignore-pattern 'tests/lint/fixtures/**'"
```

Run: `npm run lint`
Expected: codice 0.

- [ ] **Step 8: Scrivere il workflow di CI**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [master] }
  pull_request:

jobs:
  verifica:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: chiave-di-build
          NEXT_PUBLIC_APP_URL: http://localhost:3000
```

I lavori `test:db` ed `test:e2e` si aggiungono al workflow nel Task 4 e nel Task 11, quando esistono le cose da eseguire.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: vieta l'import del client service role da app/ e testa la regola

no-restricted-imports su app/, components/ e lib/repos/. La regola ha un
sorgente di prova sotto tests/lint/fixtures/app/, escluso dallo script di
lint e verificato da un test che esegue eslint e ne controlla l'uscita:
senza, la regola potrebbe essere disattivata senza che nulla lo segnali.

Aggiunge il workflow di CI con lint, type-check, test unitari e build."
```

---

# Milestone B — Schema

### Task 4: Supabase locale, harness dei test e anagrafica

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/20260729000100_anagrafica.sql`
- Create: `tests/db/harness.ts`
- Create: `tests/db/anagrafica.test.ts`
- Create: `vitest.db.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `eslint.config.mjs` (ignora `supabase/.temp/**`, generato da `supabase start`)

**Interfaces:**
- Consumes: niente
- Produces:
  - enum `public.ruolo_app` = `admin | dirigente | allenatore`
  - tabelle `public.persone`, `public.profili`
  - harness: `inRollback(fn: (c: Client) => Promise<T>): Promise<T>`, `asUser(c, userId, fn)`, `asAnon(c, fn)`, `creaUtenteAuth(c, { ruolo, personaId? }): Promise<string>`

- [ ] **Step 1: Inizializzare Supabase e avviarlo**

```bash
npm i -D supabase
npx supabase init
npx supabase start
```
Expected: l'output elenca `API URL`, `DB URL`, `anon key`, `service_role key`. Copiarle in `.env.local`, insieme a `SUPABASE_DB_URL` che i test dei task successivi leggono.

`supabase start` crea `supabase/.temp/`, che contiene JS impacchettato dell'edge runtime. È ignorato da git, ma la flat config di ESLint non legge i `.gitignore` annidati e quindi lo analizzerebbe, rompendo `npm run lint` con centinaia di problemi che non riguardano il progetto. Aggiungere `supabase/.temp/**` alla lista `ignores` di `eslint.config.mjs`.

Run: `npx supabase status | grep -i "database version"`
Expected: versione 15 o superiore. Lo schema usa `UNIQUE NULLS NOT DISTINCT`, che su Postgres 14 non esiste.

- [ ] **Step 2: Configurare il progetto di test sul database**

```bash
npm i -D pg @types/pg
```

`vitest.db.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // I test condividono un'unica istanza Postgres: niente parallelismo fra file.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
```

- [ ] **Step 3: Scrivere l'harness**

`tests/db/harness.ts`:
```ts
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * Esegue fn in una transazione con ROLLBACK garantito: ogni test parte da
 * un database pulito senza dover troncare le tabelle.
 */
export async function inRollback<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DB_URL })
  await c.connect()
  try {
    await c.query('begin')
    return await fn(c)
  } finally {
    await c.query('rollback').catch(() => {})
    await c.end()
  }
}

/**
 * Esegue fn impersonando un utente applicativo: le RLS si attivano perché
 * `authenticated` non è superuser, e auth.uid() legge request.jwt.claims.
 */
export async function asUser<T>(c: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await c.query('set local role authenticated')
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  let fallito = false
  try {
    return await fn()
  } catch (e) {
    fallito = true
    throw e
  } finally {
    // Se fn() ha fallito la transazione è già abortita e anche il cleanup
    // lancia: la sua eccezione sostituirebbe quella di fn(), e ogni test che
    // attende /row-level security/ vedrebbe "current transaction is aborted".
    // Lo swallow serve solo in quel caso: sul percorso di successo un cleanup
    // che fallisce lascerebbe il ruolo impersonato attivo per il resto della
    // transazione, e va visto.
    const ripristina = async () => {
      await c.query('set local role postgres')
      await c.query(`select set_config('request.jwt.claims', null, true)`)
    }
    if (fallito) await ripristina().catch(() => {})
    else await ripristina()
  }
}

/** Come asUser, ma senza sessione: è il caso del sito pubblico. */
export async function asAnon<T>(c: Client, fn: () => Promise<T>): Promise<T> {
  await c.query('set local role anon')
  let fallito = false
  try {
    return await fn()
  } catch (e) {
    fallito = true
    throw e
  } finally {
    // Stesso motivo di asUser: ingoiare solo se fn() ha fallito.
    const ripristina = c.query('set local role postgres')
    if (fallito) await ripristina.catch(() => {})
    else await ripristina
  }
}

/**
 * Crea una riga in auth.users e il profilo collegato, restituendo l'id.
 * Inserisce direttamente perché i test girano sul Postgres locale come
 * superuser: non serve passare dall'API di Auth.
 */
export async function creaUtenteAuth(
  c: Client,
  opzioni: { ruolo: 'admin' | 'dirigente' | 'allenatore'; personaId?: string },
): Promise<string> {
  const id = randomUUID()
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                             email_confirmed_at, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', $2, '', now(), now(), now())`,
    [id, `${id}@test.local`],
  )
  await c.query(`insert into public.profili (id, persona_id, ruolo) values ($1, $2, $3)`, [
    id,
    opzioni.personaId ?? null,
    opzioni.ruolo,
  ])
  return id
}

/** Inserisce una persona e ne restituisce l'id. */
export async function creaPersona(
  c: Client,
  dati: { nome?: string; cognome?: string; dataNascita?: string; codiceFiscale?: string } = {},
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.persone (nome, cognome, data_nascita, codice_fiscale)
     values ($1, $2, $3, $4) returning id`,
    [
      dati.nome ?? 'Mario',
      dati.cognome ?? 'Rossi',
      dati.dataNascita ?? '2012-05-14',
      dati.codiceFiscale ?? null,
    ],
  )
  return rows[0].id as string
}
```

- [ ] **Step 4: Scrivere i test che devono fallire**

`tests/db/anagrafica.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { creaPersona, creaUtenteAuth, inRollback } from './harness'

describe('persone', () => {
  it('accetta una persona con i soli campi obbligatori', () =>
    inRollback(async (c) => {
      const id = await creaPersona(c)
      const { rows } = await c.query('select attiva from public.persone where id = $1', [id])
      expect(rows[0].attiva).toBe(true)
    }))

  it('rifiuta due persone con lo stesso codice fiscale', () =>
    inRollback(async (c) => {
      await creaPersona(c, { codiceFiscale: 'RSSMRA12E14A000X' })
      await expect(creaPersona(c, { codiceFiscale: 'RSSMRA12E14A000X' })).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('ammette più persone senza codice fiscale', () =>
    inRollback(async (c) => {
      await creaPersona(c, { codiceFiscale: undefined })
      await expect(creaPersona(c, { codiceFiscale: undefined })).resolves.toBeTruthy()
    }))
})

describe('profili', () => {
  it('impedisce un allenatore senza persona collegata', () =>
    inRollback(async (c) => {
      await expect(creaUtenteAuth(c, { ruolo: 'allenatore' })).rejects.toThrow(
        /profili_allenatore_ha_persona/,
      )
    }))

  it('ammette un allenatore con persona collegata', () =>
    inRollback(async (c) => {
      const persona = await creaPersona(c)
      await expect(
        creaUtenteAuth(c, { ruolo: 'allenatore', personaId: persona }),
      ).resolves.toBeTruthy()
    }))

  it('ammette un admin senza persona collegata', () =>
    inRollback(async (c) => {
      await expect(creaUtenteAuth(c, { ruolo: 'admin' })).resolves.toBeTruthy()
    }))
})
```

- [ ] **Step 5: Eseguire i test e verificare che falliscano**

Run: `npm run test:db`
Expected: FAIL — `relation "public.persone" does not exist`.

- [ ] **Step 6: Scrivere la migration**

`supabase/migrations/20260729000100_anagrafica.sql`:
```sql
-- Anagrafica permanente e account applicativi.
-- Nessun organization_id: l'applicazione è a organizzazione singola.

create type public.ruolo_app as enum ('admin', 'dirigente', 'allenatore');

create table public.persone (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cognome        text not null,
  data_nascita   date not null,
  codice_fiscale text unique,
  email          text,
  telefono       text,
  indirizzo      text,
  citta          text,
  cap            text,
  provincia      text,
  note           text,
  attiva         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.persone.attiva is
  'Archiviazione soft: le persone non si cancellano, si disattivano.';

create index persone_cognome_idx on public.persone (cognome, nome);

create table public.profili (
  id         uuid primary key references auth.users (id) on delete cascade,
  persona_id uuid references public.persone (id) on delete restrict,
  ruolo      public.ruolo_app not null,
  attivo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profili_allenatore_ha_persona
    check (ruolo <> 'allenatore' or persona_id is not null)
);

comment on constraint profili_allenatore_ha_persona on public.profili is
  'Le RLS dell''allenatore passano da profili.persona_id a incarichi_staff: '
  'un allenatore senza persona collegata non vedrebbe nessuna squadra.';

create index profili_persona_idx on public.profili (persona_id);

-- Aggiornamento automatico di updated_at su tutte le tabelle che lo hanno.
create or replace function public.tocca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger persone_updated_at before update on public.persone
  for each row execute function public.tocca_updated_at();
create trigger profili_updated_at before update on public.profili
  for each row execute function public.tocca_updated_at();
```

- [ ] **Step 7: Applicare la migration ed eseguire i test**

Run: `npm run db:reset && npm run test:db`
Expected: PASS, 6 test (3 su `persone`, 3 su `profili`).

- [ ] **Step 8: Aggiungere il lavoro sul database alla CI**

In `.github/workflows/ci.yml`, dopo il job `verifica`, aggiungere:
```yaml
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset
      - run: npm run test:db
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: anagrafica persone e profili, con harness dei test sul database

L'harness isola ogni test in una transazione con rollback e sa impersonare
utenti applicativi (set local role + request.jwt.claims), che è il modo in
cui verificheremo le RLS nel Task 9.

Il vincolo profili_allenatore_ha_persona impedisce un allenatore senza
persona collegata: le sue RLS passano da profili.persona_id, quindi senza
quel legame non vedrebbe nessuna squadra e il bug sarebbe silenzioso."
```

---

### Task 5: Stagioni e squadre

**Files:**
- Create: `supabase/migrations/20260729000200_stagioni_squadre.sql`
- Create: `lib/domain/stagione.ts`, `tests/unit/stagione.test.ts`
- Create: `tests/db/stagioni.test.ts`
- Modify: `tests/db/harness.ts` (aggiunge `creaStagione`, `creaSquadra`)

**Interfaces:**
- Consumes: `inRollback` dal Task 4
- Produces:
  - enum `public.stato_stagione` = `aperta | chiusa`
  - tabelle `public.stagioni`, `public.squadre`
  - `etichettaDaCodice(codice: string): string` — `'2026-27'` → `'2026/2027'`
  - harness: `creaStagione(c, { codice?, stato?, dataInizio?, dataFine? }): Promise<string>`, `creaSquadra(c, stagioneId, { nome?, categoria?, annata? }): Promise<string>`

- [ ] **Step 1: Scrivere i test che devono fallire**

`tests/db/stagioni.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { creaSquadra, creaStagione, inRollback } from './harness'

describe('stagioni', () => {
  it('accetta un codice nella forma 2026-27', () =>
    inRollback(async (c) => {
      await expect(creaStagione(c, { codice: '2026-27' })).resolves.toBeTruthy()
    }))

  it.each(['2026/2027', '2026-2027', 'anagrafica', 'admin', '26-27'])(
    'rifiuta il codice %s',
    (codice) =>
      inRollback(async (c) => {
        await expect(creaStagione(c, { codice })).rejects.toThrow(/stagioni_codice_forma/)
      }),
  )

  it('rifiuta una data di fine precedente a quella di inizio', () =>
    inRollback(async (c) => {
      await expect(
        creaStagione(c, { dataInizio: '2026-09-01', dataFine: '2026-08-31' }),
      ).rejects.toThrow(/stagioni_date_coerenti/)
    }))

  it('rifiuta due stagioni con lo stesso codice', () =>
    inRollback(async (c) => {
      await creaStagione(c, { codice: '2026-27' })
      await expect(creaStagione(c, { codice: '2026-27' })).rejects.toThrow(/duplicate key/)
    }))

  it('nasce aperta', () =>
    inRollback(async (c) => {
      const id = await creaStagione(c)
      const { rows } = await c.query('select stato from public.stagioni where id = $1', [id])
      expect(rows[0].stato).toBe('aperta')
    }))
})

describe('squadre', () => {
  it('rifiuta due squadre con lo stesso nome nella stessa stagione', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      await creaSquadra(c, stagione, { nome: 'Pulcini A' })
      await expect(creaSquadra(c, stagione, { nome: 'Pulcini A' })).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('ammette lo stesso nome in due stagioni diverse', () =>
    inRollback(async (c) => {
      const a = await creaStagione(c, { codice: '2025-26' })
      const b = await creaStagione(c, { codice: '2026-27' })
      await creaSquadra(c, a, { nome: 'Pulcini A' })
      await expect(creaSquadra(c, b, { nome: 'Pulcini A' })).resolves.toBeTruthy()
    }))

  it('impedisce di cancellare una stagione che ha squadre', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      await creaSquadra(c, stagione)
      await expect(
        c.query('delete from public.stagioni where id = $1', [stagione]),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})
```

- [ ] **Step 2: Estrarre la derivazione dell'etichetta e testarla**

L'etichetta si ricava dal codice in tre punti — harness, dati di prova del repository e azione di creazione. Tre copie della stessa formula divergono; sta in `lib/domain/`, che ospita le funzioni pure di formattazione.

`lib/domain/stagione.ts`:
```ts
/**
 * Etichetta leggibile a partire dal codice: '2026-27' -> '2026/2027'.
 * Il codice ha forma garantita dal vincolo stagioni_codice_forma.
 */
export function etichettaDaCodice(codice: string): string {
  const inizio = codice.slice(0, 4)
  const fine = codice.slice(5)
  return `${inizio}/${inizio.slice(0, 2)}${fine}`
}
```

`tests/unit/stagione.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'

describe('etichettaDaCodice', () => {
  it.each([
    ['2026-27', '2026/2027'],
    ['2025-26', '2025/2026'],
    ['1999-00', '1999/1900'],
  ])('%s diventa %s', (codice, atteso) => {
    expect(etichettaDaCodice(codice)).toBe(atteso)
  })
})
```

Il terzo caso documenta un limite noto: a cavallo di secolo la formula produce `1999/1900`. Non serve gestirlo — la società non ha stagioni precedenti al 2000 e non ne avrà a cavallo del 2100. Il test esiste perché il comportamento sia scelto e non scoperto.

Run: `npm run test:unit -- stagione`
Expected: PASS, 3 casi.

- [ ] **Step 3: Aggiungere le funzioni all'harness**

In `tests/db/harness.ts`, in coda (importando `etichettaDaCodice` da `@/lib/domain/stagione`):
```ts
export async function creaStagione(
  c: Client,
  dati: { codice?: string; stato?: 'aperta' | 'chiusa'; dataInizio?: string; dataFine?: string } = {},
): Promise<string> {
  const codice = dati.codice ?? '2026-27'
  const { rows } = await c.query(
    `insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      codice,
      etichettaDaCodice(codice),
      dati.dataInizio ?? '2026-09-01',
      dati.dataFine ?? '2027-06-30',
      dati.stato ?? 'aperta',
    ],
  )
  return rows[0].id as string
}

export async function creaSquadra(
  c: Client,
  stagioneId: string,
  dati: { nome?: string; categoria?: string; annata?: number } = {},
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.squadre (stagione_id, nome, categoria, annata)
     values ($1, $2, $3, $4) returning id`,
    [stagioneId, dati.nome ?? 'Pulcini A', dati.categoria ?? 'Pulcini', dati.annata ?? 2015],
  )
  return rows[0].id as string
}
```

- [ ] **Step 4: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- stagioni`
Expected: FAIL — `relation "public.stagioni" does not exist`.

- [ ] **Step 5: Scrivere la migration**

`supabase/migrations/20260729000200_stagioni_squadre.sql`:
```sql
create type public.stato_stagione as enum ('aperta', 'chiusa');

create table public.stagioni (
  id          uuid primary key default gen_random_uuid(),
  codice      text not null unique,
  etichetta   text not null,
  data_inizio date not null,
  data_fine   date not null,
  stato       public.stato_stagione not null default 'aperta',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stagioni_date_coerenti check (data_fine > data_inizio),
  constraint stagioni_codice_forma check (codice ~ '^\d{4}-\d{2}$')
);

comment on constraint stagioni_codice_forma on public.stagioni is
  'Il codice è un segmento di URL accanto ai segmenti statici anagrafica e '
  'admin. La forma vincolata rende impossibile una collisione di rotta.';

comment on table public.stagioni is
  'Nessun flag `attiva`: la stagione corrente è la prima con stato = ''aperta'' '
  'ordinata per data_inizio desc.';

create table public.squadre (
  id          uuid primary key default gen_random_uuid(),
  stagione_id uuid not null references public.stagioni (id) on delete restrict,
  nome        text not null,
  categoria   text not null,
  annata      integer,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (stagione_id, nome),
  -- Appoggio per le chiavi esterne composite di tesseramenti, incarichi_staff
  -- e sedute_allenamento: ridondante rispetto alla primary key, ma necessaria.
  unique (id, stagione_id)
);

create index squadre_stagione_idx on public.squadre (stagione_id);

create trigger stagioni_updated_at before update on public.stagioni
  for each row execute function public.tocca_updated_at();
create trigger squadre_updated_at before update on public.squadre
  for each row execute function public.tocca_updated_at();
```

- [ ] **Step 6: Applicare ed eseguire i test**

Run: `npm run db:reset && npm run test:db && npm run test:unit`
Expected: PASS (6 di anagrafica + 12 di stagioni e squadre + gli unit esistenti).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: stagioni e squadre, con codice stagione vincolato dal database

Il CHECK sulla forma del codice (^\\d{4}-\\d{2}\$) rende impossibile per
costruzione una stagione che collida con i segmenti statici anagrafica e
admin, invece di affidarsi alla convenzione.

Nessun flag attiva: la stagione corrente si deriva. Il vecchio sistema
aveva due sorgenti in conflitto, stagioni_sportive.attiva e il parametro
stagione_corrente_id."
```

---

### Task 6: Tesseramenti e incarichi dello staff

**Files:**
- Create: `supabase/migrations/20260729000300_tesseramenti.sql`
- Create: `tests/db/tesseramenti.test.ts`
- Modify: `tests/db/harness.ts` (aggiunge `creaTesseramento`, `creaIncarico`)

**Interfaces:**
- Consumes: `creaStagione`, `creaSquadra`, `creaPersona`, `inRollback`
- Produces:
  - enum `public.ruolo_staff` = `allenatore | vice_allenatore | dirigente_squadra`
  - tabelle `public.tesseramenti`, `public.incarichi_staff`
  - indice `tesseramenti_squadra_maglia_uidx`
  - harness: `creaTesseramento(c, { personaId, stagioneId, squadraId?, numeroMaglia?, visitaScadenza? }): Promise<string>`, `creaIncarico(c, { personaId, stagioneId, squadraId, ruolo? }): Promise<string>`

- [ ] **Step 1: Scrivere i test che devono fallire**

`tests/db/tesseramenti.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  creaIncarico, creaPersona, creaSquadra, creaStagione, creaTesseramento, inRollback,
} from './harness'

describe('tesseramenti', () => {
  it('rifiuta due tesseramenti della stessa persona nella stessa stagione', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadraA = await creaSquadra(c, stagione, { nome: 'A' })
      const squadraB = await creaSquadra(c, stagione, { nome: 'B' })
      const persona = await creaPersona(c)
      await creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadraA })
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadraB }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it('ammette la stessa persona in due stagioni diverse', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const persona = await creaPersona(c)
      await creaTesseramento(c, { personaId: persona, stagioneId: s1 })
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: s2 }),
      ).resolves.toBeTruthy()
    }))

  it('ammette un tesseramento senza squadra assegnata', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: null }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta una squadra che appartiene a un\'altra stagione', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: s2, squadraId: squadraDiS1 }),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})

describe('numero di maglia', () => {
  it('rifiuta la stessa maglia due volte nella stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: squadra, numeroMaglia: 10 })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: squadra, numeroMaglia: 10 }),
      ).rejects.toThrow(/tesseramenti_squadra_maglia_uidx/)
    }))

  it('ammette la stessa maglia in due squadre diverse', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const sqA = await creaSquadra(c, stagione, { nome: 'A' })
      const sqB = await creaSquadra(c, stagione, { nome: 'B' })
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: sqA, numeroMaglia: 10 })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: sqB, numeroMaglia: 10 }),
      ).resolves.toBeTruthy()
    }))

  it('ammette più tesserati senza numero di maglia nella stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaTesseramento(c, { personaId: a, stagioneId: stagione, squadraId: squadra })
      await expect(
        creaTesseramento(c, { personaId: b, stagioneId: stagione, squadraId: squadra }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta un numero fuori dall\'intervallo 1-99', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const persona = await creaPersona(c)
      await expect(
        creaTesseramento(c, { personaId: persona, stagioneId: stagione, squadraId: squadra, numeroMaglia: 0 }),
      ).rejects.toThrow(/tesseramenti_maglia_intervallo/)
    }))
})

describe('incarichi staff', () => {
  it('ammette lo stesso allenatore su più squadre', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const sqA = await creaSquadra(c, stagione, { nome: 'A' })
      const sqB = await creaSquadra(c, stagione, { nome: 'B' })
      const persona = await creaPersona(c)
      await creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: sqA })
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: sqB }),
      ).resolves.toBeTruthy()
    }))

  it('ammette più vice allenatori sulla stessa squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const a = await creaPersona(c, { codiceFiscale: 'AAA' })
      const b = await creaPersona(c, { codiceFiscale: 'BBB' })
      await creaIncarico(c, { personaId: a, stagioneId: stagione, squadraId: squadra, ruolo: 'vice_allenatore' })
      await expect(
        creaIncarico(c, { personaId: b, stagioneId: stagione, squadraId: squadra, ruolo: 'vice_allenatore' }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta lo stesso incarico due volte per la stessa persona e squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const squadra = await creaSquadra(c, stagione)
      const persona = await creaPersona(c)
      await creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: squadra })
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: stagione, squadraId: squadra }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it('rifiuta una squadra di un\'altra stagione', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      const persona = await creaPersona(c)
      await expect(
        creaIncarico(c, { personaId: persona, stagioneId: s2, squadraId: squadraDiS1 }),
      ).rejects.toThrow(/violates foreign key constraint/)
    }))
})
```

- [ ] **Step 2: Aggiungere le funzioni all'harness**

In `tests/db/harness.ts`, in coda:
```ts
export async function creaTesseramento(
  c: Client,
  dati: {
    personaId: string
    stagioneId: string
    squadraId?: string | null
    numeroMaglia?: number | null
    visitaScadenza?: string | null
    visitaConsegnataIl?: string | null
  },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.tesseramenti
       (persona_id, stagione_id, squadra_id, numero_maglia, visita_consegnata_il, visita_scadenza)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      dati.personaId,
      dati.stagioneId,
      dati.squadraId ?? null,
      dati.numeroMaglia ?? null,
      dati.visitaConsegnataIl ?? null,
      dati.visitaScadenza ?? null,
    ],
  )
  return rows[0].id as string
}

export async function creaIncarico(
  c: Client,
  dati: {
    personaId: string
    stagioneId: string
    squadraId: string
    ruolo?: 'allenatore' | 'vice_allenatore' | 'dirigente_squadra'
  },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.incarichi_staff (persona_id, stagione_id, squadra_id, ruolo)
     values ($1, $2, $3, $4) returning id`,
    [dati.personaId, dati.stagioneId, dati.squadraId, dati.ruolo ?? 'allenatore'],
  )
  return rows[0].id as string
}
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- tesseramenti`
Expected: FAIL — `relation "public.tesseramenti" does not exist`.

- [ ] **Step 4: Scrivere la migration**

`supabase/migrations/20260729000300_tesseramenti.sql`:
```sql
create type public.ruolo_staff as enum ('allenatore', 'vice_allenatore', 'dirigente_squadra');

create table public.tesseramenti (
  id                   uuid primary key default gen_random_uuid(),
  persona_id           uuid not null references public.persone (id) on delete restrict,
  stagione_id          uuid not null references public.stagioni (id) on delete restrict,
  squadra_id           uuid,
  numero_maglia        integer,
  visita_consegnata_il date,
  visita_scadenza      date,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (persona_id, stagione_id),
  constraint tesseramenti_maglia_intervallo
    check (numero_maglia is null or numero_maglia between 1 and 99),
  -- Chiave esterna composita: la squadra deve appartenere alla stessa stagione
  -- del tesseramento. Nel vecchio schema questo errore era possibile e muto.
  --
  -- `set null (squadra_id)` con la lista di colonne, non `set null` nudo:
  -- su una FK multi-colonna Postgres annullerebbe TUTTE le colonne locali,
  -- quindi anche stagione_id, che è NOT NULL — e la cancellazione della
  -- squadra abortirebbe. La sintassi con lista esiste da Postgres 15.
  -- Semantica volutamente: cancellata la squadra, il giocatore resta
  -- tesserato per la stagione ma senza squadra assegnata.
  constraint tesseramenti_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete set null (squadra_id)
);

comment on column public.tesseramenti.squadra_id is
  'Nullo = tesserato ma non ancora assegnato a una squadra.';
comment on column public.tesseramenti.visita_consegnata_il is
  'Informativo. Lo stato della visita si calcola da visita_scadenza: i dati '
  'storici migrati non hanno la data di consegna.';

-- Il vincolo sulla maglia è un indice parziale: Postgres non ammette WHERE
-- in una UNIQUE dichiarata inline.
create unique index tesseramenti_squadra_maglia_uidx
  on public.tesseramenti (squadra_id, numero_maglia)
  where numero_maglia is not null;

create index tesseramenti_stagione_squadra_idx
  on public.tesseramenti (stagione_id, squadra_id);
create index tesseramenti_persona_idx on public.tesseramenti (persona_id);
create index tesseramenti_visita_scadenza_idx
  on public.tesseramenti (visita_scadenza) where visita_scadenza is not null;

create table public.incarichi_staff (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.persone (id) on delete restrict,
  stagione_id uuid not null,
  squadra_id  uuid not null,
  ruolo       public.ruolo_staff not null,
  created_at  timestamptz not null default now(),
  unique (persona_id, squadra_id, ruolo),
  constraint incarichi_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete cascade
);

comment on table public.incarichi_staff is
  'Una riga per incarico: sostituisce le colonne allenatore_id, '
  'vice_allenatore_1_id e vice_allenatore_2_id del vecchio schema.';

create index incarichi_squadra_idx on public.incarichi_staff (squadra_id);
create index incarichi_persona_idx on public.incarichi_staff (persona_id);

create trigger tesseramenti_updated_at before update on public.tesseramenti
  for each row execute function public.tocca_updated_at();
```

- [ ] **Step 5: Applicare ed eseguire i test**

Run: `npm run db:reset && npm run test:db`
Expected: PASS, tutti i test dei task 4, 5 e 6.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tesseramenti e incarichi staff con chiave esterna composita

La FK (squadra_id, stagione_id) verso squadre(id, stagione_id) impedisce a
un tesseramento o a un incarico di puntare a una squadra di un'altra
stagione. Nel vecchio schema quell'incoerenza era possibile e non lasciava
traccia.

incarichi_staff sostituisce le colonne numerate vice_allenatore_1_id e
vice_allenatore_2_id: un allenatore può stare su più squadre e una squadra
avere quanti vice serve."
```

---

### Task 7: Quote, pagamenti e vista dello stato

**Files:**
- Create: `supabase/migrations/20260729000400_quote.sql`
- Create: `tests/db/quote.test.ts`
- Modify: `tests/db/harness.ts` (aggiunge `impostaQuota`, `registraPagamento`, `leggiQuota`)

**Interfaces:**
- Consumes: `creaTesseramento`, `creaSquadra`, `creaStagione`, `creaPersona`
- Produces:
  - enum `public.metodo_pagamento` = `contanti | bonifico | altro`
  - tabelle `public.quote_importi`, `public.pagamenti_quota`
  - view `public.v_quote (tesseramento_id, quota_attesa, pagato, residuo, stato)`
  - harness: `impostaQuota(c, { stagioneId? , squadraId?, tesseramentoId?, importo }): Promise<void>`, `registraPagamento(c, tesseramentoId, importo, data?): Promise<void>`, `leggiQuota(c, tesseramentoId): Promise<{ quota_attesa: string; pagato: string; residuo: string; stato: string }>`

- [ ] **Step 1: Scrivere i test che devono fallire**

`tests/db/quote.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  creaPersona, creaSquadra, creaStagione, creaTesseramento,
  impostaQuota, inRollback, leggiQuota, registraPagamento,
} from './harness'

async function scenario(c: Client) {
  const stagione = await creaStagione(c)
  const squadra = await creaSquadra(c, stagione)
  const persona = await creaPersona(c)
  const tesseramento = await creaTesseramento(c, {
    personaId: persona, stagioneId: stagione, squadraId: squadra,
  })
  return { stagione, squadra, tesseramento }
}

describe('quote_importi', () => {
  it('rifiuta una riga che non indica esattamente un livello', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await expect(
        c.query(
          `insert into public.quote_importi (stagione_id, squadra_id, importo)
           values ($1, $2, 250)`,
          [stagione, squadra],
        ),
      ).rejects.toThrow(/quote_importi_un_solo_livello/)
    }))

  it('rifiuta una riga senza nessun livello', () =>
    inRollback(async (c) => {
      await expect(
        c.query(`insert into public.quote_importi (importo) values (250)`),
      ).rejects.toThrow(/quote_importi_un_solo_livello/)
    }))

  it('ammette un solo importo per stagione', () =>
    inRollback(async (c) => {
      const { stagione } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await expect(impostaQuota(c, { stagioneId: stagione, importo: 300 })).rejects.toThrow(
        /duplicate key/,
      )
    }))
})

describe('v_quote — risoluzione dell\'importo atteso', () => {
  it('usa il default della stagione quando non ci sono override', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('250.00')
    }))

  it('l\'override di squadra vince sul default di stagione', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('280.00')
    }))

  it('l\'override del tesseramento vince su tutti', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await impostaQuota(c, { squadraId: squadra, importo: 280 })
      await impostaQuota(c, { tesseramentoId: tesseramento, importo: 125 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('125.00')
    }))
})

describe('v_quote — stato', () => {
  it('non_pagato senza versamenti', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('non_pagato')
      expect(q.residuo).toBe('250.00')
    }))

  it('parziale con metà quota versata', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 125)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('parziale')
      expect(q.residuo).toBe('125.00')
    }))

  it('saldato con due versamenti che coprono la quota', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 125)
      await registraPagamento(c, tesseramento, 125)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('saldato')
      expect(q.residuo).toBe('0.00')
    }))

  it('saldato con residuo negativo quando si versa più del dovuto', () =>
    inRollback(async (c) => {
      const { stagione, tesseramento } = await scenario(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, tesseramento, 300)
      const q = await leggiQuota(c, tesseramento)
      expect(q.stato).toBe('saldato')
      expect(q.residuo).toBe('-50.00')
    }))

  it('saldato quando nessuna quota è configurata', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      const q = await leggiQuota(c, tesseramento)
      expect(q.quota_attesa).toBe('0.00')
      expect(q.stato).toBe('saldato')
    }))

  it('usa il default di stagione anche per un tesserato senza squadra', () =>
    inRollback(async (c) => {
      const stagione = await creaStagione(c)
      const persona = await creaPersona(c)
      const tesseramento = await creaTesseramento(c, {
        personaId: persona, stagioneId: stagione, squadraId: null,
      })
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      expect((await leggiQuota(c, tesseramento)).quota_attesa).toBe('250.00')
    }))
})

describe('pagamenti_quota', () => {
  it('rifiuta un importo non positivo', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      await expect(registraPagamento(c, tesseramento, 0)).rejects.toThrow(
        /pagamenti_importo_positivo/,
      )
    }))

  it('cancella i pagamenti quando si cancella il tesseramento', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      await registraPagamento(c, tesseramento, 100)
      await c.query('delete from public.tesseramenti where id = $1', [tesseramento])
      const { rows } = await c.query(
        'select count(*)::int as n from public.pagamenti_quota where tesseramento_id = $1',
        [tesseramento],
      )
      expect(rows[0].n).toBe(0)
    }))
})
```

- [ ] **Step 2: Aggiungere le funzioni all'harness**

In `tests/db/harness.ts`, in coda:
```ts
export async function impostaQuota(
  c: Client,
  dati: { stagioneId?: string; squadraId?: string; tesseramentoId?: string; importo: number },
): Promise<void> {
  await c.query(
    `insert into public.quote_importi (stagione_id, squadra_id, tesseramento_id, importo)
     values ($1, $2, $3, $4)`,
    [dati.stagioneId ?? null, dati.squadraId ?? null, dati.tesseramentoId ?? null, dati.importo],
  )
}

export async function registraPagamento(
  c: Client,
  tesseramentoId: string,
  importo: number,
  data = '2026-09-15',
): Promise<void> {
  await c.query(
    `insert into public.pagamenti_quota (tesseramento_id, importo, data)
     values ($1, $2, $3)`,
    [tesseramentoId, importo, data],
  )
}

export async function leggiQuota(c: Client, tesseramentoId: string) {
  const { rows } = await c.query(
    `select quota_attesa::text, pagato::text, residuo::text, stato
     from public.v_quote where tesseramento_id = $1`,
    [tesseramentoId],
  )
  return rows[0] as { quota_attesa: string; pagato: string; residuo: string; stato: string }
}
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- quote`
Expected: FAIL — `relation "public.quote_importi" does not exist`.

- [ ] **Step 4: Scrivere la migration**

`supabase/migrations/20260729000400_quote.sql`:
```sql
create type public.metodo_pagamento as enum ('contanti', 'bonifico', 'altro');

-- Tutti gli importi vivono qui, e solo qui: le RLS filtrano righe e non
-- colonne, e `stagioni` e `squadre` sono leggibili senza login per il sito
-- pubblico. Tenere gli importi fuori da quelle tabelle è ciò che impedisce
-- a un allenatore e a un utente anonimo di vederli.
create table public.quote_importi (
  id              uuid primary key default gen_random_uuid(),
  stagione_id     uuid unique references public.stagioni (id) on delete cascade,
  squadra_id      uuid unique references public.squadre (id) on delete cascade,
  tesseramento_id uuid unique references public.tesseramenti (id) on delete cascade,
  importo         numeric(10,2) not null check (importo >= 0),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint quote_importi_un_solo_livello
    check (num_nonnulls(stagione_id, squadra_id, tesseramento_id) = 1)
);

comment on constraint quote_importi_un_solo_livello on public.quote_importi is
  'Le tre UNIQUE convivono perché per ogni riga due colonne su tre sono nulle '
  'e Postgres considera i NULL distinti. Non aggiungere NULLS NOT DISTINCT.';

create table public.pagamenti_quota (
  id              uuid primary key default gen_random_uuid(),
  tesseramento_id uuid not null references public.tesseramenti (id) on delete cascade,
  importo         numeric(10,2) not null,
  data            date not null,
  metodo          public.metodo_pagamento not null default 'contanti',
  note            text,
  registrato_da   uuid references public.profili (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint pagamenti_importo_positivo check (importo > 0)
);

create index pagamenti_tesseramento_idx on public.pagamenti_quota (tesseramento_id);

create trigger quote_importi_updated_at before update on public.quote_importi
  for each row execute function public.tocca_updated_at();

-- Stato della quota. È l'unica implementazione della regola: non esiste una
-- copia in TypeScript.
create view public.v_quote with (security_invoker = true) as
with versato as (
  select tesseramento_id, sum(importo) as pagato
  from public.pagamenti_quota
  group by tesseramento_id
)
select
  t.id as tesseramento_id,
  coalesce(qt.importo, qs.importo, qst.importo, 0)::numeric(10,2) as quota_attesa,
  coalesce(v.pagato, 0)::numeric(10,2) as pagato,
  (coalesce(qt.importo, qs.importo, qst.importo, 0) - coalesce(v.pagato, 0))::numeric(10,2)
    as residuo,
  case
    when coalesce(qt.importo, qs.importo, qst.importo, 0) = 0 then 'saldato'
    when coalesce(v.pagato, 0) = 0 then 'non_pagato'
    when coalesce(v.pagato, 0) < coalesce(qt.importo, qs.importo, qst.importo, 0) then 'parziale'
    else 'saldato'
  end as stato
from public.tesseramenti t
left join public.quote_importi qt  on qt.tesseramento_id = t.id
left join public.quote_importi qs  on qs.squadra_id = t.squadra_id
left join public.quote_importi qst on qst.stagione_id = t.stagione_id
left join versato v on v.tesseramento_id = t.id;

comment on view public.v_quote is
  'security_invoker: le RLS delle tabelle sottostanti valgono per il chiamante. '
  'Un allenatore non ha policy su quote_importi né su pagamenti_quota, quindi '
  'legge zeri e stato ''saldato'' — nessuna cifra reale. Il layer di repository '
  'rifiuta comunque la chiamata per i ruoli non autorizzati.';
```

- [ ] **Step 5: Applicare ed eseguire i test**

Run: `npm run db:reset && npm run test:db`
Expected: PASS, tutti i test fino al task 7.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: quote su tre livelli e vista dello stato di pagamento

quote_importi tiene gli importi fuori da stagioni e squadre, che il sito
pubblico legge senza login, e fuori da tesseramenti, che l'allenatore
legge: le RLS filtrano righe e non colonne, quindi la separazione per
tabella è l'unico modo per nascondere le cifre a chi non deve vederle.

v_quote è l'unica implementazione dello stato quota. Casi coperti dai
test: nessun versamento, metà, saldo esatto, eccedenza con residuo
negativo, nessuna quota configurata, tesserato senza squadra."
```

---

### Task 8: Sedute di allenamento, presenze e statistiche

**Files:**
- Create: `supabase/migrations/20260729000500_presenze.sql` (crea sedute e presenze, e altera `tesseramenti` per aggiungere l'appoggio della FK composita)
- Create: `tests/db/presenze.test.ts`
- Modify: `tests/db/harness.ts` (aggiunge `creaSeduta`, `registraPresenza`, `leggiPresenze`)

**Interfaces:**
- Consumes: `creaTesseramento`, `creaSquadra`, `creaStagione`, `creaPersona`
- Produces:
  - enum `public.stato_presenza` = `presente | assente | giustificato | infortunato`
  - tabelle `public.sedute_allenamento` (con `unique (id, squadra_id)`), `public.presenze` (con `squadra_id` NOT NULL e due FK composite)
  - vincolo `tesseramenti_id_squadra_key` aggiunto a `public.tesseramenti`
  - view `public.v_presenze (tesseramento_id, sedute_squadra, presenti, assenti, giustificati, infortuni, non_registrate, percentuale)`
  - harness: `creaSeduta(c, { squadraId, stagioneId, data?, oraInizio? }): Promise<string>`, `registraPresenza(c, sedutaId, tesseramentoId, stato): Promise<void>`, `leggiPresenze(c, tesseramentoId)`

- [ ] **Step 1: Scrivere i test che devono fallire**

`tests/db/presenze.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  creaPersona, creaSeduta, creaSquadra, creaStagione, creaTesseramento,
  inRollback, leggiPresenze, registraPresenza,
} from './harness'

async function scenario(c: Client) {
  const stagione = await creaStagione(c)
  const squadra = await creaSquadra(c, stagione)
  const persona = await creaPersona(c)
  const tesseramento = await creaTesseramento(c, {
    personaId: persona, stagioneId: stagione, squadraId: squadra,
  })
  return { stagione, squadra, tesseramento }
}

describe('sedute_allenamento', () => {
  it('rifiuta due sedute nello stesso giorno senza ora', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: null })
      await expect(
        creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: null }),
      ).rejects.toThrow(/duplicate key/)
    }))

  it('ammette due sedute nello stesso giorno con orari diversi', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: '17:00' })
      await expect(
        creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01', oraInizio: '19:00' }),
      ).resolves.toBeTruthy()
    }))

  it('rifiuta una squadra di un\'altra stagione', () =>
    inRollback(async (c) => {
      const s1 = await creaStagione(c, { codice: '2025-26' })
      const s2 = await creaStagione(c, { codice: '2026-27' })
      const squadraDiS1 = await creaSquadra(c, s1)
      await expect(
        creaSeduta(c, { squadraId: squadraDiS1, stagioneId: s2 }),
      ).rejects.toThrow(/sedute_squadra_di_stagione/)
    }))
})

describe('presenze', () => {
  it('rifiuta due righe per lo stesso giocatore nella stessa seduta', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await expect(registraPresenza(c, seduta, tesseramento, 'assente')).rejects.toThrow(
        /duplicate key/,
      )
    }))

  it('cancella le presenze quando si cancella la seduta', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await c.query('delete from public.sedute_allenamento where id = $1', [seduta])
      const { rows } = await c.query('select count(*)::int as n from public.presenze')
      expect(rows[0].n).toBe(0)
    }))

  it('rifiuta un giocatore su una seduta di un\'altra squadra', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      const sedutaAltra = await creaSeduta(c, { squadraId: altra, stagioneId: stagione })
      // Insert scritta a mano: registraPresenza ricava squadra_id dalla seduta
      // e non potrebbe produrre la combinazione incoerente.
      await expect(
        c.query(
          `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
           values ($1, $2, $3, 'presente')`,
          [sedutaAltra, tesseramento, squadra],
        ),
      ).rejects.toThrow(/presenze_seduta_di_squadra/)
    }))

  it('rifiuta un tesseramento di un\'altra squadra sulla seduta', () =>
    inRollback(async (c) => {
      // L'altra metà della garanzia. Questa combinazione — seduta di A,
      // tesseramento di B, squadra_id di A — è quella che registraPresenza
      // produrrebbe da sé, e che solo il vincolo differito rifiuta: senza
      // renderlo immediato il test passerebbe senza verificare nulla.
      await c.query('set constraints presenze_tesseramento_di_squadra immediate')
      const { stagione, squadra } = await scenario(c)
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      const tesseratoAltra = await creaTesseramento(c, {
        personaId: await creaPersona(c, { codiceFiscale: 'ALTRA' }),
        stagioneId: stagione,
        squadraId: altra,
      })
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await expect(registraPresenza(c, seduta, tesseratoAltra, 'presente')).rejects.toThrow(
        /presenze_tesseramento_di_squadra/,
      )
    }))

  it('rifiuta di spostare un tesseramento con presenze già registrate', () =>
    inRollback(async (c) => {
      // Il vincolo è `deferrable initially deferred`: dentro una transazione
      // che finisce in rollback la verifica non avverrebbe mai e il test
      // passerebbe senza controllare nulla. In produzione la stessa
      // violazione emerge al commit.
      await c.query('set constraints presenze_tesseramento_di_squadra immediate')
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      await expect(
        c.query('update public.tesseramenti set squadra_id = $1 where id = $2', [
          altra,
          tesseramento,
        ]),
      ).rejects.toThrow(/presenze_tesseramento_di_squadra/)
    }))

  it('cancellare una squadra porta via sedute e presenze', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, { squadraId: squadra, stagioneId: stagione })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await c.query('delete from public.squadre where id = $1', [squadra])
      // Forza subito il check che il vincolo differito rimanderebbe al commit:
      // senza questo il test proverebbe che l'istruzione riesce, non che la
      // transazione potrebbe chiudersi — che è la proprietà per cui il vincolo
      // è differito.
      await c.query('set constraints all immediate')
      const { rows } = await c.query(
        `select (select count(*)::int from public.presenze) as presenze,
                (select count(*)::int from public.sedute_allenamento) as sedute,
                (select squadra_id from public.tesseramenti where id = $1) as squadra_tesseramento,
                -- La stagione deve SOPRAVVIVERE: su una FK multi-colonna un
                -- set null nudo annullerebbe anche questa, e senza questa
                -- asserzione il difetto resterebbe invisibile.
                (select stagione_id from public.tesseramenti where id = $1) as stagione_tesseramento`,
        [tesseramento],
      )
      expect(rows[0]).toEqual({
        presenze: 0,
        sedute: 0,
        squadra_tesseramento: null,
        stagione_tesseramento: stagione,
      })
    }))
})

describe('v_presenze', () => {
  it('percentuale nulla quando la squadra non ha sedute', () =>
    inRollback(async (c) => {
      const { tesseramento } = await scenario(c)
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(0)
      expect(s.percentuale).toBeNull()
    }))

  it('conta i quattro stati separatamente', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const stati = ['presente', 'assente', 'giustificato', 'infortunato'] as const
      for (const [i, stato] of stati.entries()) {
        const seduta = await creaSeduta(c, {
          squadraId: squadra, stagioneId: stagione, data: `2026-10-0${i + 1}`,
        })
        await registraPresenza(c, seduta, tesseramento, stato)
      }
      const s = await leggiPresenze(c, tesseramento)
      expect(s).toMatchObject({
        sedute_squadra: 4, presenti: 1, assenti: 1, giustificati: 1, infortuni: 1,
        non_registrate: 0,
      })
      expect(s.percentuale).toBe('25.0')
    }))

  it('le sedute non compilate contano nel denominatore e in non_registrate', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const seduta = await creaSeduta(c, {
        squadraId: squadra, stagioneId: stagione, data: '2026-10-01',
      })
      await registraPresenza(c, seduta, tesseramento, 'presente')
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-08' })
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-15' })
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(3)
      expect(s.presenti).toBe(1)
      expect(s.non_registrate).toBe(2)
      expect(s.percentuale).toBe('33.3')
    }))

  it('chi si tessera a stagione iniziata ha percentuale bassa e non_registrate alto', () =>
    inRollback(async (c) => {
      const { stagione, squadra } = await scenario(c)
      const tardivo = await creaTesseramento(c, {
        personaId: await creaPersona(c, { codiceFiscale: 'TARDIVO' }),
        stagioneId: stagione, squadraId: squadra,
      })
      for (const giorno of ['01', '08', '15', '22']) {
        await creaSeduta(c, {
          squadraId: squadra, stagioneId: stagione, data: `2026-10-${giorno}`,
        })
      }
      const ultima = await creaSeduta(c, {
        squadraId: squadra, stagioneId: stagione, data: '2026-10-29',
      })
      await registraPresenza(c, ultima, tardivo, 'presente')
      const s = await leggiPresenze(c, tardivo)
      expect(s.sedute_squadra).toBe(5)
      expect(s.non_registrate).toBe(4)
      expect(s.percentuale).toBe('20.0')
    }))

  it('non conta le sedute di altre squadre', () =>
    inRollback(async (c) => {
      const { stagione, squadra, tesseramento } = await scenario(c)
      const altra = await creaSquadra(c, stagione, { nome: 'Altra' })
      await creaSeduta(c, { squadraId: squadra, stagioneId: stagione, data: '2026-10-01' })
      await creaSeduta(c, { squadraId: altra, stagioneId: stagione, data: '2026-10-02' })
      const s = await leggiPresenze(c, tesseramento)
      expect(s.sedute_squadra).toBe(1)
    }))
})
```

- [ ] **Step 2: Aggiungere le funzioni all'harness**

In `tests/db/harness.ts`, in coda:
```ts
export async function creaSeduta(
  c: Client,
  dati: { squadraId: string; stagioneId: string; data?: string; oraInizio?: string | null },
): Promise<string> {
  const { rows } = await c.query(
    `insert into public.sedute_allenamento (squadra_id, stagione_id, data, ora_inizio)
     values ($1, $2, $3, $4) returning id`,
    [dati.squadraId, dati.stagioneId, dati.data ?? '2026-10-01', dati.oraInizio ?? null],
  )
  return rows[0].id as string
}

/**
 * Registra una presenza ricavando `squadra_id` dalla seduta, così i chiamanti
 * non devono conoscere la colonna denormalizzata.
 *
 * ATTENZIONE: ricavare la squadra dalla seduta rende impossibile violare
 * `presenze_seduta_di_squadra`, ma NON `presenze_tesseramento_di_squadra`.
 * Passando un tesseramento di un'altra squadra si ottiene la combinazione
 * (seduta di A, tesseramento di B, squadra_id = A), che il vincolo immediato
 * accetta e solo quello differito rifiuta — quindi al commit. Dentro
 * `inRollback` il commit non arriva mai e la riga invalida passa inosservata:
 * un test che deve vederla rifiutata dichiari prima
 * `set constraints presenze_tesseramento_di_squadra immediate`.
 */
export async function registraPresenza(
  c: Client,
  sedutaId: string,
  tesseramentoId: string,
  stato: 'presente' | 'assente' | 'giustificato' | 'infortunato',
): Promise<void> {
  const { rowCount } = await c.query(
    `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
     select s.id, $2, s.squadra_id, $3
     from public.sedute_allenamento s where s.id = $1`,
    [sedutaId, tesseramentoId, stato],
  )
  // L'insert nasce da un select: una seduta inesistente inserirebbe zero righe
  // e risolverebbe in silenzio, lasciando un'asserzione vuota a valle.
  //
  // Da quando le RLS sono attive questa guardia scatta anche per un secondo
  // motivo: quel select è filtrato dalle policy di lettura del chiamante,
  // quindi su una seduta che non gli è visibile l'helper solleva "seduta
  // inesistente" invece di tentare la insert. Un test che deve verificare una
  // WITH CHECK su una seduta altrui non può passare da qui: serve una insert
  // diretta con `squadra_id` esplicita.
  if (rowCount !== 1) throw new Error(`seduta inesistente: ${sedutaId}`)
}

export async function leggiPresenze(c: Client, tesseramentoId: string) {
  const { rows } = await c.query(
    `select sedute_squadra, presenti, assenti, giustificati, infortuni,
            non_registrate, percentuale::text as percentuale
     from public.v_presenze where tesseramento_id = $1`,
    [tesseramentoId],
  )
  return rows[0] as {
    sedute_squadra: number; presenti: number; assenti: number; giustificati: number
    infortuni: number; non_registrate: number; percentuale: string | null
  }
}
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- presenze`
Expected: FAIL — `relation "public.sedute_allenamento" does not exist`.

- [ ] **Step 4: Scrivere la migration**

`supabase/migrations/20260729000500_presenze.sql`:
```sql
create type public.stato_presenza as enum
  ('presente', 'assente', 'giustificato', 'infortunato');

create table public.sedute_allenamento (
  id          uuid primary key default gen_random_uuid(),
  squadra_id  uuid not null,
  stagione_id uuid not null,
  data        date not null,
  ora_inizio  time,
  note        text,
  created_by  uuid references public.profili (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- NULLS NOT DISTINCT richiede Postgres 15: senza, due sedute nello stesso
  -- giorno con ora nulla sarebbero ammesse come righe distinte.
  constraint sedute_squadra_data_ora_key
    unique nulls not distinct (squadra_id, data, ora_inizio),
  constraint sedute_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete cascade,
  -- Appoggio per la FK composita di `presenze`: ridondante rispetto alla
  -- primary key, necessaria perché Postgres pretende una UNIQUE su
  -- esattamente le colonne referenziate.
  unique (id, squadra_id)
);

-- Stesso appoggio su tesseramenti, creata nella migration precedente.
-- Sta qui perché serve solo da questa migration in avanti.
alter table public.tesseramenti add constraint tesseramenti_id_squadra_key
  unique (id, squadra_id);

comment on table public.sedute_allenamento is
  'La seduta è un''entità: distingue "allenamento non compilato" da "tutti '
  'assenti" e dà un denominatore definito alle percentuali di presenza.';

-- Nessun indice aggiuntivo su (squadra_id, data): il prefisso di
-- sedute_squadra_data_ora_key copre già quelle interrogazioni, e un btree si
-- percorre anche a rovescio per `data desc`. Due strutture per un solo
-- pattern di accesso sono solo scritture in più da mantenere.

create table public.presenze (
  id              uuid primary key default gen_random_uuid(),
  seduta_id       uuid not null,
  tesseramento_id uuid not null,
  -- Denormalizzata e NOT NULL. Con le due FK composite sotto, è ciò che
  -- impedisce di registrare un giocatore su una seduta di un'altra squadra:
  -- la stessa squadra deve comparire da entrambi i lati. NOT NULL è
  -- obbligatorio, perché con la semantica MATCH SIMPLE una colonna nulla
  -- soddisfa una FK composita a vuoto e la garanzia svanisce.
  squadra_id      uuid not null,
  stato           public.stato_presenza not null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (seduta_id, tesseramento_id),
  constraint presenze_seduta_di_squadra
    foreign key (seduta_id, squadra_id)
    references public.sedute_allenamento (id, squadra_id) on delete cascade,
  -- Differito: una `delete from squadre` innesca più percorsi di cascade
  -- (sedute e presenze via cascade, tesseramenti.squadra_id via set null) e
  -- Postgres li esegue nell'ordine alfabetico dei nomi dei trigger, che per
  -- quelli di integrità referenziale contengono l'oid — quindi segue l'ordine
  -- di creazione solo finché gli oid hanno la stessa ampiezza in cifre. Lo
  -- stato finale è coerente, quello intermedio no. Verificare a fine
  -- transazione invece che per istruzione rende la garanzia indipendente da
  -- quell'ordine, che nessun dump o squash di migration promette di
  -- preservare. Cambia QUANDO una violazione viene segnalata, non SE.
  constraint presenze_tesseramento_di_squadra
    foreign key (tesseramento_id, squadra_id)
    references public.tesseramenti (id, squadra_id) on delete cascade
    deferrable initially deferred
);

comment on constraint presenze_tesseramento_di_squadra on public.presenze is
  'Spostare un tesseramento in un''altra squadra viene rifiutato finché '
  'esistono presenze sulla vecchia: quelle presenze appartengono alla squadra '
  'dove sono state raccolte. Essendo il vincolo differito, dentro una sola '
  'transazione si possono spostare il tesseramento e cancellare le presenze '
  'in qualunque ordine, perché conta solo lo stato a fine transazione. '
  'Spostare le presenze insieme al giocatore non è invece possibile: la loro '
  'seduta resta della vecchia squadra e quel vincolo è immediato.';

create index presenze_tesseramento_idx on public.presenze (tesseramento_id);

create trigger sedute_updated_at before update on public.sedute_allenamento
  for each row execute function public.tocca_updated_at();
create trigger presenze_updated_at before update on public.presenze
  for each row execute function public.tocca_updated_at();

-- Statistiche di presenza. Unica implementazione della regola.
create view public.v_presenze with (security_invoker = true) as
with sedute_per_squadra as (
  select squadra_id, count(*)::int as sedute
  from public.sedute_allenamento
  group by squadra_id
)
select
  t.id as tesseramento_id,
  coalesce(sps.sedute, 0) as sedute_squadra,
  count(p.id) filter (where p.stato = 'presente')::int     as presenti,
  count(p.id) filter (where p.stato = 'assente')::int      as assenti,
  count(p.id) filter (where p.stato = 'giustificato')::int  as giustificati,
  count(p.id) filter (where p.stato = 'infortunato')::int   as infortuni,
  (coalesce(sps.sedute, 0) - count(p.id))::int             as non_registrate,
  case
    when coalesce(sps.sedute, 0) = 0 then null
    else round(
      count(p.id) filter (where p.stato = 'presente')::numeric * 100 / sps.sedute, 1)
  end as percentuale
from public.tesseramenti t
left join sedute_per_squadra sps on sps.squadra_id = t.squadra_id
left join public.presenze p on p.tesseramento_id = t.id
group by t.id, sps.sedute;

comment on view public.v_presenze is
  'Il denominatore sono tutte le sedute della squadra, comprese quelle senza '
  'riga per quel giocatore: non_registrate rende visibili i buchi invece di '
  'gonfiare la percentuale. percentuale è 0-100 con un decimale, nulla se la '
  'squadra non ha sedute.';
```

- [ ] **Step 5: Applicare ed eseguire i test**

Run: `npm run db:reset && npm run test:db`
Expected: PASS, tutti i test fino al task 8.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: sedute di allenamento, presenze e vista delle statistiche

La seduta è un'entità: distingue allenamento non compilato da tutti
assenti, ammette due sedute nello stesso giorno e dà un denominatore
definito alle percentuali.

v_presenze conta nel denominatore anche le sedute senza riga per quel
giocatore ed espone non_registrate. Chi si tessera a stagione iniziata
risulta con percentuale bassa e non_registrate alto: è la lettura onesta,
il vecchio sistema nascondeva le sedute non compilate."
```

---

### Task 9: Funzioni helper e matrice RLS

**Files:**
- Create: `supabase/migrations/20260729000600_rls.sql`
- Create: `tests/db/rls.test.ts`

**Interfaces:**
- Consumes: tutte le tabelle dei task 4–8; `asUser`, `asAnon`, `creaUtenteAuth` dall'harness
- Produces:
  - schema `app` con `app.mio_ruolo()`, `app.mia_persona()`, `app.mie_squadre()`, `app.stagione_aperta(uuid)`
  - RLS attiva su tutte e 10 le tabelle, con le policy della matrice dello spec §6

**Perché la suite si autovalida, e cosa non va mai toccato.** Il Task 4 ha costruito `asUser` ma nessun suo test lo esercita: senza policy non c'è niente da restringere. Qui l'impersonificazione viene usata per la prima volta, e la suite contiene già il proprio controllo — a patto che resti bilanciata.

Se `set local role authenticated` o `set_config('request.jwt.claims', ...)` non funzionassero, `auth.uid()` sarebbe nullo, `app.mio_ruolo()` restituirebbe `null`, ogni policy risulterebbe falsa e **tutti i test di diniego passerebbero** mentre quelli di permesso fallirebbero con zero righe. Il contrario — un ruolo con `BYPASSRLS` — farebbe fallire i dinieghi. Quindi ogni ruolo ha bisogno di almeno un test di permesso *e* uno di diniego: sono i due lati del controllo. Un test di permesso cancellato o indebolito per "farlo passare" trasforma l'intera matrice in un falso verde.

Il primo test del blocco `funzioni helper` (`mio_ruolo legge il ruolo del profilo corrente`) è il controllo più diretto: se l'impersonificazione è rotta restituisce `null` invece di `'dirigente'`. Va trattato come test di infrastruttura, non come test di comodo.

- [ ] **Step 1: Scrivere i test che devono fallire**

`tests/db/rls.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  asAnon, asUser, creaIncarico, creaPersona, creaSeduta, creaSquadra, creaStagione,
  creaTesseramento, creaUtenteAuth, impostaQuota, inRollback, registraPagamento,
} from './harness'

/**
 * Due squadre nella stessa stagione. L'allenatore ha un incarico solo su A.
 * È lo scenario su cui si misura ogni diniego.
 */
async function dueSquadre(c: Client) {
  const stagione = await creaStagione(c, { codice: '2026-27' })
  const squadraA = await creaSquadra(c, stagione, { nome: 'A' })
  const squadraB = await creaSquadra(c, stagione, { nome: 'B' })

  const personaMister = await creaPersona(c, { codiceFiscale: 'MISTER' })
  await creaIncarico(c, { personaId: personaMister, stagioneId: stagione, squadraId: squadraA })
  const mister = await creaUtenteAuth(c, { ruolo: 'allenatore', personaId: personaMister })
  const dirigente = await creaUtenteAuth(c, { ruolo: 'dirigente' })
  const admin = await creaUtenteAuth(c, { ruolo: 'admin' })

  const giocatoreA = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-A' }),
    stagioneId: stagione, squadraId: squadraA,
  })
  const giocatoreB = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-B' }),
    stagioneId: stagione, squadraId: squadraB,
  })
  const sedutaA = await creaSeduta(c, { squadraId: squadraA, stagioneId: stagione, data: '2026-10-01' })
  const sedutaB = await creaSeduta(c, { squadraId: squadraB, stagioneId: stagione, data: '2026-10-01' })

  return { stagione, squadraA, squadraB, mister, dirigente, admin, giocatoreA, giocatoreB, sedutaA, sedutaB }
}

async function conta(c: Client, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await c.query(sql, params)
  return rows.length
}

describe('funzioni helper', () => {
  it('mio_ruolo legge il ruolo del profilo corrente', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBe('dirigente')
    }))

  it('mie_squadre restituisce solo le squadre con incarico', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const squadre = await asUser(c, mister, async () => {
        const { rows } = await c.query('select * from app.mie_squadre() as s')
        return rows.map((r) => r.s)
      })
      expect(squadre).toEqual([squadraA])
    }))

  it('un profilo disattivato non ha ruolo', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await c.query('update public.profili set attivo = false where id = $1', [dirigente])
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBeNull()
    }))
})

describe('allenatore — lettura', () => {
  it('vede i tesseramenti della propria squadra', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('NON vede i tesseramenti della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le persone della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, `select id from public.persone where codice_fiscale = 'GIOC-B'`),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le sedute della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))
})

describe('allenatore — scrittura', () => {
  it('inserisce presenze sulla propria seduta', () =>
    inRollback(async (c) => {
      const { mister, sedutaA, giocatoreA } = await dueSquadre(c)
      await asUser(c, mister, async () => {
        await c.query(
          `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
           select s.id, $2, s.squadra_id, 'presente'
           from public.sedute_allenamento s where s.id = $1`,
          [sedutaA, giocatoreA],
        )
      })
      const { rows } = await c.query('select count(*)::int as n from public.presenze')
      expect(rows[0].n).toBe(1)
    }))

  it('NON inserisce presenze sulla seduta della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB, sedutaB, giocatoreB } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          // Insert diretta con squadra_id esplicita, non `registraPresenza`.
          // L'helper ricava la squadra con un select sulla seduta, e quel
          // select è a sua volta filtrato dalla policy di lettura
          // dell'allenatore: su una seduta altrui non vede la riga, inserisce
          // zero righe e solleva "seduta inesistente" — un errore che non
          // dimostra nulla sulla WITH CHECK, che è ciò che questo test verifica.
          c.query(
            `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
             values ($1, $2, $3, 'presente')`,
            [sedutaB, giocatoreB, squadraB],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON modifica i tesseramenti', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      const esito = await asUser(c, mister, () =>
        c.query('update public.tesseramenti set numero_maglia = 7 where id = $1', [giocatoreA]),
      )
      expect(esito.rowCount).toBe(0) // nessuna riga aggiornabile: la USING non passa
    }))

  it('NON crea squadre', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('allenatore — dati finanziari', () => {
  it('NON legge quote_importi', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      const n = await asUser(c, mister, () => conta(c, 'select id from public.quote_importi'))
      expect(n).toBe(0)
    }))

  it('NON legge pagamenti_quota', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      await registraPagamento(c, giocatoreA, 125)
      const n = await asUser(c, mister, () => conta(c, 'select id from public.pagamenti_quota'))
      expect(n).toBe(0)
    }))

  it('da v_quote non ricava cifre reali', () =>
    inRollback(async (c) => {
      const { mister, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, mister, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '0.00', pagato: '0.00', stato: 'saldato' })
    }))

  it('il dirigente legge le cifre reali', () =>
    inRollback(async (c) => {
      const { dirigente, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, dirigente, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '250.00', pagato: '125.00', stato: 'parziale' })
    }))
})

describe('stagione chiusa', () => {
  it('resta leggibile', () =>
    inRollback(async (c) => {
      const { mister, stagione, squadraA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('rifiuta le scritture dell\'allenatore', () =>
    inRollback(async (c) => {
      const { mister, stagione, sedutaA, giocatoreA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
             select s.id, $2, s.squadra_id, 'presente'
             from public.sedute_allenamento s where s.id = $1`,
            [sedutaA, giocatoreA],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('rifiuta le scritture del dirigente', () =>
    inRollback(async (c) => {
      const { dirigente, stagione } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Tardiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('dirigente e admin', () => {
  it('il dirigente vede i tesseramenti di tutte le squadre', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const n = await asUser(c, dirigente, () => conta(c, 'select id from public.tesseramenti'))
      expect(n).toBe(2)
    }))

  it('il dirigente NON crea stagioni', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
             values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('l\'admin crea stagioni', () =>
    inRollback(async (c) => {
      const { admin } = await dueSquadre(c)
      await asUser(c, admin, () =>
        c.query(
          `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
           values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
        ),
      )
      const { rows } = await c.query('select count(*)::int as n from public.stagioni')
      expect(rows[0].n).toBe(2)
    }))
})

describe('utente anonimo', () => {
  it('legge stagioni e squadre', () =>
    inRollback(async (c) => {
      await dueSquadre(c)
      const esito = await asAnon(c, async () => ({
        stagioni: await conta(c, 'select id from public.stagioni'),
        squadre: await conta(c, 'select id from public.squadre'),
      }))
      expect(esito).toEqual({ stagioni: 1, squadre: 2 })
    }))

  it.each([
    'persone', 'profili', 'tesseramenti', 'incarichi_staff',
    'sedute_allenamento', 'presenze', 'quote_importi', 'pagamenti_quota',
  ])('NON raggiunge %s', (tabella) =>
    inRollback(async (c) => {
      await dueSquadre(c)
      // anon non ha nemmeno il privilegio di tabella: il rifiuto arriva prima
      // che una policy venga valutata. È la barriera esterna delle due.
      await expect(
        asAnon(c, () => c.query(`select * from public.${tabella}`)),
      ).rejects.toThrow(/permission denied/)
    }))

  it('non ha privilegi né policy oltre stagioni e squadre', () =>
    inRollback(async (c) => {
      // Il test che avrebbe intercettato il buco su TRUNCATE: asserisce
      // l'insieme esatto dei privilegi di anon, non solo che una lettura
      // fallisce. Copre anche il caso di una policy `to anon` aggiunta in
      // futuro senza grant, che oggi lascerebbe tutto verde con un buco
      // latente pronto ad attivarsi al primo grant.
      const { rows: privilegi } = await c.query(
        `select table_name, privilege_type from information_schema.table_privileges
         where table_schema = 'public' and grantee = 'anon' order by 1, 2`,
      )
      expect(privilegi).toEqual([
        { table_name: 'squadre', privilege_type: 'SELECT' },
        { table_name: 'stagioni', privilege_type: 'SELECT' },
      ])
      const { rows: policy } = await c.query(
        `select tablename, policyname from pg_policies
         where schemaname = 'public' and 'anon' = any(roles) order by 1`,
      )
      expect(policy).toEqual([
        { tablename: 'squadre', policyname: 'squadre_sel' },
        { tablename: 'stagioni', policyname: 'stagioni_sel' },
      ])
    }))

  it('NON scrive squadre, che invece legge', () =>
    inRollback(async (c) => {
      const { stagione } = await dueSquadre(c)
      // Il grant ad anon è `select` soltanto: la scrittura cade sul privilegio,
      // non sulla policy.
      await expect(
        asAnon(c, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/permission denied/)
    }))
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- rls`
Expected: FAIL — `schema "app" does not exist`.

- [ ] **Step 3: Scrivere la migration — funzioni helper**

`supabase/migrations/20260729000600_rls.sql`, prima parte:
```sql
create schema if not exists app;
grant usage on schema app to anon, authenticated;

-- SECURITY DEFINER: legge profili senza attivarne le RLS, così la policy su
-- profili non interroga profili e non può ricorrere. `set search_path = ''`
-- con nomi qualificati impedisce a un chiamante di dirottare la risoluzione
-- di `public.profili` su una propria tabella.
create or replace function app.mio_ruolo() returns public.ruolo_app
  language sql stable security definer set search_path = '' as $$
    select p.ruolo from public.profili p where p.id = auth.uid() and p.attivo
  $$;

create or replace function app.mia_persona() returns uuid
  language sql stable security definer set search_path = '' as $$
    select p.persona_id from public.profili p where p.id = auth.uid() and p.attivo
  $$;

create or replace function app.mie_squadre() returns setof uuid
  language sql stable security definer set search_path = '' as $$
    select i.squadra_id from public.incarichi_staff i
    where i.persona_id = app.mia_persona()
  $$;

create or replace function app.stagione_aperta(p_stagione uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.stagioni s where s.id = p_stagione and s.stato = 'aperta'
    )
  $$;

grant execute on function
  app.mio_ruolo(), app.mia_persona(), app.mie_squadre(), app.stagione_aperta(uuid)
  to anon, authenticated;
```

- [ ] **Step 4: Scrivere la migration — policy di stagioni, squadre, profili, persone**

Nello stesso file, in coda:
```sql
alter table public.stagioni           enable row level security;
alter table public.squadre            enable row level security;
alter table public.persone            enable row level security;
alter table public.profili            enable row level security;
alter table public.tesseramenti       enable row level security;
alter table public.incarichi_staff    enable row level security;
alter table public.sedute_allenamento enable row level security;
alter table public.presenze           enable row level security;
alter table public.quote_importi      enable row level security;
alter table public.pagamenti_quota    enable row level security;

-- I privilegi di tabella NON sono più concessi automaticamente: nel CLI
-- Supabase attuale `auto_expose_new_tables` non è impostato, che è il nuovo
-- default condiviso col cloud, e le tabelle create dal ruolo postgres non
-- sono raggiungibili da anon/authenticated senza un grant esplicito. Senza i
-- grant qui sotto ogni query fallirebbe con "permission denied for table"
-- prima che una policy venga valutata.
--
-- Il grant ad `anon` è deliberatamente minimo: sola lettura e solo sulle due
-- tabelle che il sito pubblico mostra. La chiave anon viaggia nel bundle del
-- browser, quindi se un domani una policy sbagliata rendesse `persone`
-- leggibile, il privilegio mancante resterebbe come seconda barriera fra
-- quella chiave e i dati personali di minori.
grant select on public.stagioni, public.squadre to anon;

grant select, insert, update, delete on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota
  to authenticated;

-- Le viste sono security_invoker: oltre alle RLS delle tabelle sottostanti
-- serve il privilegio SELECT sulla vista stessa. Sono di sola lettura.
grant select on public.v_quote, public.v_presenze to authenticated;

-- service_role scavalca le RLS per progetto, ma i privilegi di tabella gli
-- servono comunque: senza questi, lo script di seed del Task 11 fallisce con
-- "permission denied". Lo usano solo gli script in scripts/, e una regola
-- ESLint vieta di importarne il client da app/, components/ e lib/repos/.
-- Nessun TRUNCATE nemmeno qui.
grant select, insert, update, delete on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota
  to service_role;

-- pg_default_acl del ruolo postgres concede Dxtm (truncate, references,
-- trigger, maintain) ad anon e authenticated su ogni tabella creata dalle
-- migration. Le RLS hanno verbi per select, insert, update e delete: per
-- TRUNCATE non esiste policy che possa filtrarlo. Senza questa revoke la
-- chiave anon — che viaggia nel bundle del browser — non può leggere
-- l'indirizzo di un minore ma può cancellarli tutti, insieme a
-- pagamenti_quota. references e trigger oggi non sono sfruttabili, perché
-- anon e authenticated non hanno CREATE su public e quindi non possiedono
-- oggetti a cui appenderli: si revocano comunque, sono gratis.
-- Le due view vanno incluse: per GRANT e REVOKE contano come tabelle e
-- ricevono gli stessi default. Su una view TRUNCATE è inerte, ma il test
-- strutturale sotto asserisce l'insieme esatto dei privilegi di anon in tutto
-- lo schema, e senza queste due resterebbe rosso.
revoke truncate, references, trigger, maintain on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota,
  public.v_quote, public.v_presenze
  from anon, authenticated;

-- Le tabelle delle migration future ereditano la restrizione, invece di
-- dipendere dal fatto che qualcuno se lo ricordi.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- Con RLS attiva e i privilegi concessi, l'assenza di policy per una
-- combinazione ruolo/verbo equivale al diniego.

-- STAGIONI: lette da tutti (il sito pubblico ne ha bisogno), scritte dall'admin.
create policy stagioni_sel on public.stagioni for select to anon, authenticated
  using (true);
create policy stagioni_ins on public.stagioni for insert to authenticated
  with check (app.mio_ruolo() = 'admin');
create policy stagioni_upd on public.stagioni for update to authenticated
  using (app.mio_ruolo() = 'admin') with check (app.mio_ruolo() = 'admin');
create policy stagioni_del on public.stagioni for delete to authenticated
  using (app.mio_ruolo() = 'admin');

-- SQUADRE: lette da tutti, scritte da admin e dirigente su stagioni aperte.
create policy squadre_sel on public.squadre for select to anon, authenticated
  using (true);
create policy squadre_ins on public.squadre for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy squadre_upd on public.squadre for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy squadre_del on public.squadre for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- PROFILI: la policy di lettura non usa subquery, quindi non può ricorrere.
create policy profili_sel_proprio on public.profili for select to authenticated
  using (id = auth.uid());
create policy profili_sel_staff on public.profili for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy profili_ins on public.profili for insert to authenticated
  with check (app.mio_ruolo() = 'admin');
create policy profili_upd on public.profili for update to authenticated
  using (app.mio_ruolo() = 'admin') with check (app.mio_ruolo() = 'admin');
create policy profili_del on public.profili for delete to authenticated
  using (app.mio_ruolo() = 'admin');

-- PERSONE: staff tutte; allenatore solo quelle presenti nelle proprie squadre.
create policy persone_sel_staff on public.persone for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_sel_allenatore on public.persone for select to authenticated
  using (
    app.mio_ruolo() = 'allenatore'
    and (
      id in (select t.persona_id from public.tesseramenti t
             where t.squadra_id in (select app.mie_squadre()))
      or id in (select i.persona_id from public.incarichi_staff i
                where i.squadra_id in (select app.mie_squadre()))
    )
  );
create policy persone_ins on public.persone for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_upd on public.persone for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'))
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_del on public.persone for delete to authenticated
  using (app.mio_ruolo() = 'admin');
```

- [ ] **Step 5: Scrivere la migration — policy di tesseramenti, incarichi, sedute, presenze**

Nello stesso file, in coda:
```sql
-- TESSERAMENTI
create policy tesseramenti_sel_staff on public.tesseramenti for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy tesseramenti_sel_allenatore on public.tesseramenti for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy tesseramenti_ins on public.tesseramenti for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy tesseramenti_upd on public.tesseramenti for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy tesseramenti_del on public.tesseramenti for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- INCARICHI STAFF
create policy incarichi_sel_staff on public.incarichi_staff for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy incarichi_sel_allenatore on public.incarichi_staff for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy incarichi_ins on public.incarichi_staff for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy incarichi_upd on public.incarichi_staff for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy incarichi_del on public.incarichi_staff for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- SEDUTE: l'allenatore le gestisce sulle proprie squadre.
create policy sedute_sel_staff on public.sedute_allenamento for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy sedute_sel_allenatore on public.sedute_allenamento for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy sedute_ins on public.sedute_allenamento for insert to authenticated
  with check (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );
create policy sedute_upd on public.sedute_allenamento for update to authenticated
  using (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  )
  with check (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );
create policy sedute_del on public.sedute_allenamento for delete to authenticated
  using (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );

-- PRESENZE: la visibilità passa dalla seduta.
create policy presenze_sel_staff on public.presenze for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy presenze_sel_allenatore on public.presenze for select to authenticated
  using (
    app.mio_ruolo() = 'allenatore'
    and seduta_id in (select s.id from public.sedute_allenamento s
                      where s.squadra_id in (select app.mie_squadre()))
  );
create policy presenze_ins on public.presenze for insert to authenticated
  with check (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );
create policy presenze_upd on public.presenze for update to authenticated
  using (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  )
  with check (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );
create policy presenze_del on public.presenze for delete to authenticated
  using (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );
```

- [ ] **Step 6: Scrivere la migration — policy delle tabelle finanziarie**

Nello stesso file, in coda:
```sql
-- QUOTE E PAGAMENTI: nessuna policy per allenatore né per anon.
-- La lettura non è vincolata alla stagione aperta, altrimenti lo storico
-- dei pagamenti diventerebbe invisibile invece che immutabile.
create policy quote_sel on public.quote_importi for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_ins on public.quote_importi for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_upd on public.quote_importi for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'))
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_del on public.quote_importi for delete to authenticated
  using (app.mio_ruolo() = 'admin');

create policy pagamenti_sel on public.pagamenti_quota for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy pagamenti_ins on public.pagamenti_quota for insert to authenticated
  with check (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
create policy pagamenti_upd on public.pagamenti_quota for update to authenticated
  using (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  )
  with check (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
create policy pagamenti_del on public.pagamenti_quota for delete to authenticated
  using (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
```

- [ ] **Step 7: Applicare ed eseguire i test**

Run: `npm run db:reset && npm run test:db`
Expected: PASS, tutti i test. Se un diniego atteso non scatta, la policy corrispondente è troppo permissiva: correggere la policy, non il test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: funzioni helper e matrice RLS su tutte le tabelle

Le funzioni app.* sono SECURITY DEFINER con search_path vuoto e nomi
qualificati: la policy su profili non interroga profili e non può
ricorrere come nel vecchio sistema, e nessun chiamante può dirottare la
risoluzione di public.profili su una propria tabella.

Le policy sono separate per verbo. La condizione stagione_aperta sta solo
sulle scritture: su una FOR ALL renderebbe invisibili le stagioni chiuse
invece di renderle in sola lettura, e lo storico sparirebbe.

I test coprono i dinieghi, non solo i permessi: l'allenatore della squadra
A non legge la rosa di B e non inserisce presenze sulle sedute di B, in
lettura e in scrittura separatamente."
```

---

# Milestone C — Autenticazione e shell

### Task 10: Client Supabase, tipi generati e sessione

**Files:**
- Create: `lib/db/types.ts` (generato)
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`
- Create: `scripts/env.ts`
- Create: `lib/auth/session.ts`
- Create: `lib/log.ts`
- Create: `tests/db/sessione.test.ts`

**Interfaces:**
- Consumes: schema completo dei task 4–9
- Produces:
  - `type Database` da `lib/db/types.ts`
  - `type Db = SupabaseClient<Database>`
  - `supabaseServer(): Promise<Db>`, `supabaseBrowser(): Db`, `supabaseAdmin(): Db`
  - `type Sessione = { userId: string; ruolo: RuoloApp; personaId: string | null }`
  - `getSessione(db: Db): Promise<Sessione | null>`
  - `richiediRuolo(db: Db, ruoli: RuoloApp[]): Promise<Sessione>` — lancia `ErroreAutorizzazione`
  - `class ErroreAutorizzazione extends Error`
  - `log.info/warn/error(evento: string, dati?: Record<string, string | number | null>)`

- [ ] **Step 1: Installare le dipendenze e generare i tipi**

```bash
npm i @supabase/supabase-js @supabase/ssr
npm run db:types
```

Run: `grep -c "tesseramenti" lib/db/types.ts`
Expected: un numero maggiore di 0.

- [ ] **Step 2: Scrivere il test che deve fallire**

`tests/db/sessione.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { ErroreAutorizzazione, getSessione, richiediRuolo } from '@/lib/auth/session'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function clientServizio() {
  return createClient<Database>(URL, SERVICE, { auth: { persistSession: false } })
}

/** Crea un utente reale via API di Auth e restituisce un client autenticato. */
async function clientPerRuolo(ruolo: 'admin' | 'dirigente' | 'allenatore') {
  const servizio = clientServizio()
  const email = `${ruolo}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`
  const password = 'password-di-prova-123'
  const { data: creato, error } = await servizio.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error

  let personaId: string | null = null
  if (ruolo === 'allenatore') {
    const { data } = await servizio
      .from('persone')
      .insert({ nome: 'Mister', cognome: 'Prova', data_nascita: '1980-01-01' })
      .select('id').single()
    personaId = data!.id
  }
  await servizio.from('profili').insert({ id: creato.user.id, ruolo, persona_id: personaId })

  const utente = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
  const { error: erroreAccesso } = await utente.auth.signInWithPassword({ email, password })
  if (erroreAccesso) throw erroreAccesso
  return { db: utente, userId: creato.user.id, personaId, servizio }
}

describe('getSessione', () => {
  it('restituisce null senza sessione', async () => {
    const anonimo = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
    expect(await getSessione(anonimo)).toBeNull()
  })

  it('restituisce ruolo e persona per un allenatore', async () => {
    const { db, userId, personaId } = await clientPerRuolo('allenatore')
    expect(await getSessione(db)).toEqual({ userId, ruolo: 'allenatore', personaId })
  })

  it('restituisce null se il profilo è disattivato', async () => {
    const { db, userId, servizio } = await clientPerRuolo('dirigente')
    await servizio.from('profili').update({ attivo: false }).eq('id', userId)
    expect(await getSessione(db)).toBeNull()
  })
})

describe('richiediRuolo', () => {
  it('passa quando il ruolo è fra quelli ammessi', async () => {
    const { db, userId } = await clientPerRuolo('dirigente')
    const sessione = await richiediRuolo(db, ['admin', 'dirigente'])
    expect(sessione.userId).toBe(userId)
  })

  it('lancia ErroreAutorizzazione quando il ruolo non basta', async () => {
    const { db } = await clientPerRuolo('allenatore')
    await expect(richiediRuolo(db, ['admin', 'dirigente'])).rejects.toBeInstanceOf(
      ErroreAutorizzazione,
    )
  })

  it('lancia ErroreAutorizzazione senza sessione', async () => {
    const anonimo = createClient<Database>(URL, ANON, { auth: { persistSession: false } })
    await expect(richiediRuolo(anonimo, ['admin'])).rejects.toBeInstanceOf(ErroreAutorizzazione)
  })
})
```

Questi test scrivono davvero sul database locale, senza il rollback dell'harness: creano utenti Auth, che non si possono inserire in una transazione annullata perché passano dall'API. Usano indirizzi email casuali per non collidere fra esecuzioni.

Per lo stesso motivo **devono ripulire da soli**. È l'unica suite del progetto che lascia righe permanenti, e `test:db` gira a ogni task successivo: senza pulizia `auth.users`, `profili` e `persone` crescono a ogni esecuzione in un database condiviso, che è il modo in cui una suite diventa prima lenta e poi instabile. Tracciare gli id man mano che si creano, non cercarli per pattern dell'email a posteriori, così la pulizia non può cancellare ciò che non ha creato.

Attenzione all'ordine referenziale: `profili.id` riferisce `auth.users` con `on delete cascade`, quindi cancellare l'utente Auth porta via il profilo; ma `profili.persona_id` riferisce `persone` con `on delete restrict`, quindi le persone sopravvivono e vanno cancellate dopo, esplicitamente.

```ts
const creati: { userId: string; personaId: string | null }[] = []

afterAll(async () => {
  const servizio = clientServizio()
  for (const { userId } of creati) {
    await servizio.auth.admin.deleteUser(userId)
  }
  const persone = creati.map((c) => c.personaId).filter((id): id is string => id !== null)
  if (persone.length > 0) {
    await servizio.from('persone').delete().in('id', persone)
  }
})
```

`clientPerRuolo` registra in `creati` ciò che crea. La verifica che la pulizia funzioni non è che i test passino, ma che **due esecuzioni consecutive di `test:db` diano gli stessi conteggi**: una suite che ripulisce è idempotente, una che non lo fa deriva.

- [ ] **Step 3: Caricare `.env.local` nei test sul database**

In `vitest.db.config.ts`, aggiungere in cima al file:
```ts
import { loadEnvFile } from 'node:process'
try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }
```

- [ ] **Step 4: Eseguire il test e verificare che fallisca**

Run: `npm run test:db -- sessione`
Expected: FAIL — `Failed to resolve import "@/lib/auth/session"`.

- [ ] **Step 5: Scrivere i client Supabase**

`lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Database } from '@/lib/db/types'

export type Db = Awaited<ReturnType<typeof supabaseServer>>

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient<Database>(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (elenco) => {
          try {
            for (const { name, value, options } of elenco) store.set(name, value, options)
          } catch {
            // I Server Component non possono scrivere cookie: il rinnovo del
            // token avviene nel middleware.
          }
        },
      },
    },
  )
}
```

`lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import type { Database } from '@/lib/db/types'

export function supabaseBrowser() {
  return createBrowserClient<Database>(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
```

`scripts/env.ts`:
```ts
import { z } from 'zod'

/** Ambiente degli script: include la service role, che l'applicazione non vede. */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export function envScript() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    const problemi = esito.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Ambiente script incompleto: ${problemi}`)
  }
  return esito.data
}
```

`lib/supabase/admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { envScript } from '@/scripts/env'
import type { Database } from '@/lib/db/types'

/**
 * Client con chiave service role: ignora ogni RLS.
 * Usabile SOLO dagli script in scripts/. Una regola ESLint impedisce di
 * importarlo da app/, components/ e lib/repos/.
 */
export function supabaseAdmin() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = envScript()
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
```

Da questo punto il modulo che il sorgente di prova importa esiste davvero. Il sorgente resta escluso da `tsc` e da `npm run lint`: la sua unica ragione di esistere è far scattare la regola dentro `tests/lint/regola-admin.test.ts`.

Run: `npm run test:unit -- regola-admin`
Expected: PASS — la regola continua a scattare ora che il modulo esiste.

Questo è anche il momento di chiudere un buco residuo notato durante la ri-review del Task 3: il glob della regola copre `lib/repos/**/*.ts` ma non `.tsx`. Finché in `lib/repos/` non esistevano file la cosa era teorica; da qui in avanti quella directory si popola. In `eslint.config.mjs` estendere entrambe le voci:

```js
      'lib/repos/**/*.{ts,tsx}',
      'tests/lint/fixtures/lib/repos/**/*.{ts,tsx}',
```

e aggiungere un quinto caso a `tests/lint/regola-admin.test.ts` con un sorgente di prova `tests/lint/fixtures/lib/repos/importa-admin-tsx.tsx` che importa `'../supabase/admin'`, con le stesse asserzioni del caso `.ts`: exit non-zero e messaggio che nomina la service role. Senza il caso, il glob può restringersi di nuovo senza che nulla lo segnali.

- [ ] **Step 6: Scrivere il logger**

`lib/log.ts`:
```ts
type Dati = Record<string, string | number | boolean | null | undefined>

/**
 * Log strutturato senza dati personali: solo identificativi ed eventi.
 * Mai nomi, cognomi, codici fiscali o email — i log di produzione non
 * devono diventare un archivio di dati di minori.
 */
function scrivi(livello: 'info' | 'warn' | 'error', evento: string, dati?: Dati) {
  const riga = JSON.stringify({ livello, evento, ...dati })
  if (livello === 'error') console.error(riga)
  else if (livello === 'warn') console.warn(riga)
  else if (process.env.NODE_ENV !== 'production') console.log(riga)
}

export const log = {
  info: (evento: string, dati?: Dati) => scrivi('info', evento, dati),
  warn: (evento: string, dati?: Dati) => scrivi('warn', evento, dati),
  error: (evento: string, dati?: Dati) => scrivi('error', evento, dati),
}
```

- [ ] **Step 7: Scrivere `lib/auth/session.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

export type RuoloApp = Database['public']['Enums']['ruolo_app']
export type Sessione = { userId: string; ruolo: RuoloApp; personaId: string | null }

export class ErroreAutorizzazione extends Error {
  constructor(messaggio = 'Operazione non consentita') {
    super(messaggio)
    this.name = 'ErroreAutorizzazione'
  }
}

/** Sessione applicativa: utente Auth più profilo attivo. Null se manca uno dei due. */
export async function getSessione(db: SupabaseClient<Database>): Promise<Sessione | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data } = await db
    .from('profili')
    .select('ruolo, persona_id')
    .eq('id', user.id)
    .eq('attivo', true)
    .maybeSingle()

  if (!data) return null
  return { userId: user.id, ruolo: data.ruolo, personaId: data.persona_id }
}

/**
 * Autorizzazione applicativa. Va invocata come prima riga utile di ogni
 * Server Action: dà un errore leggibile dove le RLS darebbero un 42501.
 */
export async function richiediRuolo(
  db: SupabaseClient<Database>,
  ruoli: RuoloApp[],
): Promise<Sessione> {
  const sessione = await getSessione(db)
  if (!sessione) throw new ErroreAutorizzazione('Sessione assente')
  if (!ruoli.includes(sessione.ruolo)) {
    throw new ErroreAutorizzazione('Ruolo non autorizzato per questa operazione')
  }
  return sessione
}
```

- [ ] **Step 8: Eseguire i test e verificare che passino**

Run: `npm run test:db -- sessione`
Expected: PASS, 6 test.

- [ ] **Step 9: Verificare che lint e type-check restino verdi**

Run: `npm run lint && npm run type-check`
Expected: codice 0 per entrambi.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: client Supabase, tipi generati e sessione applicativa

getSessione richiede utente Auth e profilo attivo: un profilo disattivato
non ha sessione, senza cache da invalidare. Il vecchio sistema teneva lo
stato auth in cache per 5 minuti, quindi un ruolo revocato restava valido.

richiediRuolo riceve il client come argomento, così i test possono girare
con client autenticati per ruoli diversi contro il database reale.
admin.ts prende la service role da scripts/env.ts, separato
dall'ambiente applicativo."
```

---

### Task 11: Accesso, uscita e middleware

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/actions.ts`
- Create: `app/(auth)/logout/route.ts`
- Create: `middleware.ts`
- Create: `lib/azioni.ts`, `lib/errors/postgres.ts`
- Create: `tests/unit/postgres.test.ts`
- Create: `scripts/seed-dev.ts`
- Create: `playwright.config.ts`, `e2e/accesso.spec.ts`
- Modify: `.github/workflows/ci.yml`, `package.json`

**Interfaces:**
- Consumes: `supabaseServer`, `getSessione`, `env`, `log`
- Produces:
  - `type Risultato<T> = { ok: true; dati: T } | { ok: false; errore: string; campi?: Record<string, string> }`
  - `eseguiAzione<T>(nome: string, corpo: () => Promise<T>): Promise<Risultato<T>>`
  - `traduciErrorePostgres(e: unknown): string | null`
  - `npm run seed:dev` crea `admin@virpol.test` / `dirigente@virpol.test` / `mister@virpol.test`, password `virpol-dev-123`

- [ ] **Step 1: Scrivere il test della traduzione degli errori**

`tests/unit/postgres.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { traduciErrorePostgres } from '@/lib/errors/postgres'

describe('traduciErrorePostgres', () => {
  it('traduce la maglia duplicata', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "tesseramenti_squadra_maglia_uidx"' }
    expect(traduciErrorePostgres(e)).toMatch(/maglia/i)
  })

  it('traduce il doppio tesseramento nella stessa stagione', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "tesseramenti_persona_id_stagione_id_key"' }
    expect(traduciErrorePostgres(e)).toMatch(/già tesserat/i)
  })

  it('traduce la seduta duplicata', () => {
    const e = { code: '23505', message: 'duplicate key value violates unique constraint "sedute_squadra_data_ora_key"' }
    expect(traduciErrorePostgres(e)).toMatch(/seduta/i)
  })

  it('traduce il codice stagione malformato', () => {
    const e = { code: '23514', message: 'new row violates check constraint "stagioni_codice_forma"' }
    expect(traduciErrorePostgres(e)).toMatch(/2026-27/)
  })

  it('traduce il rifiuto delle RLS', () => {
    const e = { code: '42501', message: 'new row violates row-level security policy' }
    expect(traduciErrorePostgres(e)).toMatch(/non consentita/i)
  })

  it('restituisce null per un errore che non conosce', () => {
    expect(traduciErrorePostgres({ code: '08006', message: 'connection failure' })).toBeNull()
  })

  it('restituisce null per un valore che non è un errore Postgres', () => {
    expect(traduciErrorePostgres(new Error('boom'))).toBeNull()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm run test:unit -- postgres`
Expected: FAIL — `Failed to resolve import "@/lib/errors/postgres"`.

- [ ] **Step 3: Implementare la traduzione**

`lib/errors/postgres.ts`:
```ts
type ErrorePostgres = { code: string; message: string }

function isErrorePostgres(e: unknown): e is ErrorePostgres {
  return (
    typeof e === 'object' && e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { message?: unknown }).message === 'string'
  )
}

const perVincolo: Record<string, string> = {
  tesseramenti_squadra_maglia_uidx:
    'Questo numero di maglia è già assegnato a un altro giocatore della squadra',
  tesseramenti_persona_id_stagione_id_key:
    'Questa persona è già tesserata in questa stagione',
  sedute_squadra_data_ora_key:
    'Esiste già una seduta per questa squadra in quel giorno e a quell\'ora',
  stagioni_codice_key: 'Esiste già una stagione con questo codice',
  squadre_stagione_id_nome_key: 'Esiste già una squadra con questo nome nella stagione',
  persone_codice_fiscale_key: 'Esiste già una persona con questo codice fiscale',
  presenze_seduta_id_tesseramento_id_key:
    'Questo giocatore ha già una presenza registrata per la seduta',
  stagioni_codice_forma: 'Il codice della stagione deve avere la forma 2026-27',
  stagioni_date_coerenti: 'La data di fine deve essere successiva a quella di inizio',
  tesseramenti_maglia_intervallo: 'Il numero di maglia deve essere compreso fra 1 e 99',
  quote_importi_un_solo_livello:
    'Un importo deve riferirsi a un solo livello: stagione, squadra oppure tesseramento',
  pagamenti_importo_positivo: 'L\'importo del versamento deve essere maggiore di zero',
  profili_allenatore_ha_persona:
    'Un allenatore deve essere collegato a una persona in anagrafica',
}

/**
 * Traduce gli errori del database in messaggi per l'utente.
 * Restituisce null se l'errore non è riconosciuto: chi chiama decide se
 * mostrare un messaggio generico o lasciar propagare.
 */
export function traduciErrorePostgres(e: unknown): string | null {
  if (!isErrorePostgres(e)) return null

  if (e.code === '23505' || e.code === '23514') {
    for (const [vincolo, messaggio] of Object.entries(perVincolo)) {
      if (e.message.includes(vincolo)) return messaggio
    }
    return e.code === '23505' ? 'Valore già presente' : 'Valore non ammesso'
  }
  if (e.code === '23503') return 'Elemento collegato non più esistente: ricarica la pagina'
  if (e.code === '42501') return 'Operazione non consentita'
  return null
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm run test:unit -- postgres`
Expected: PASS, 7 test.

- [ ] **Step 5: Scrivere il wrapper delle Server Action**

`lib/azioni.ts`:
```ts
import { ErroreAutorizzazione } from '@/lib/auth/session'
import { traduciErrorePostgres } from '@/lib/errors/postgres'
import { log } from '@/lib/log'

export type Risultato<T> =
  | { ok: true; dati: T }
  | { ok: false; errore: string; campi?: Record<string, string> }

/**
 * Racchiude il corpo di una Server Action e trasforma i fallimenti previsti
 * in un Risultato. I bug veri continuano a propagare verso error.tsx: un bug
 * non deve somigliare a un errore di validazione.
 */
export async function eseguiAzione<T>(
  nome: string,
  corpo: () => Promise<T>,
): Promise<Risultato<T>> {
  try {
    return { ok: true, dati: await corpo() }
  } catch (e) {
    if (e instanceof ErroreAutorizzazione) {
      log.warn(`${nome}.negata`, { motivo: e.message })
      return { ok: false, errore: e.message }
    }
    const tradotto = traduciErrorePostgres(e)
    if (tradotto) {
      log.warn(`${nome}.rifiutata`, { codice: (e as { code: string }).code })
      return { ok: false, errore: tradotto }
    }
    throw e
  }
}
```

- [ ] **Step 6: Scrivere la pagina di accesso e la sua azione**

`app/(auth)/login/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { eseguiAzione, type Risultato } from '@/lib/azioni'
import { supabaseServer } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email('Indirizzo email non valido'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export async function accedi(_precedente: unknown, form: FormData): Promise<Risultato<null>> {
  const campi = schema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!campi.success) {
    return {
      ok: false,
      errore: 'Controlla i dati inseriti',
      campi: Object.fromEntries(
        campi.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    }
  }

  const esito = await eseguiAzione('accesso', async () => {
    const db = await supabaseServer()
    const { error } = await db.auth.signInWithPassword(campi.data)
    // Solo le credenziali sbagliate diventano un messaggio per l'utente. Un
    // rate limit, un progetto malconfigurato o un'interruzione del servizio
    // Auth sono bug: devono arrivare a error.tsx col loro errore originale,
    // non travestiti da password errata. Altrimenti si passa un pomeriggio su
    // "gli utenti dicono che la password non funziona" mentre la causa è un
    // rate limit.
    if (error?.code === 'invalid_credentials') throw new CredenzialiNonValide()
    if (error) throw error
    return null
  })

  if (!esito.ok) return esito
  redirect('/gestione')
}

class CredenzialiNonValide extends Error {
  constructor() {
    super('Email o password non corretti')
    this.name = 'CredenzialiNonValide'
  }
}
```

Il wrapper `eseguiAzione` non conosce `CredenzialiNonValide`, quindi la rilancerebbe. Aggiungere la gestione in `lib/azioni.ts`, subito dopo il ramo di `ErroreAutorizzazione`:
```ts
    if (e instanceof Error && e.name === 'CredenzialiNonValide') {
      log.warn(`${nome}.credenziali`)
      return { ok: false, errore: e.message }
    }
```

`app/(auth)/login/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { accedi } from './actions'

export default function Accesso() {
  const [esito, azione, inCorso] = useActionState(accedi, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold">Accesso</h1>
      <form action={azione} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username"
                 className="mt-1 w-full rounded border px-3 py-2" />
          {campi?.email && <p role="alert" className="mt-1 text-sm text-red-700">{campi.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required
                 autoComplete="current-password"
                 className="mt-1 w-full rounded border px-3 py-2" />
          {campi?.password && <p role="alert" className="mt-1 text-sm text-red-700">{campi.password}</p>}
        </div>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
        <button type="submit" disabled={inCorso}
                className="w-full rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-60">
          {inCorso ? 'Accesso in corso…' : 'Entra'}
        </button>
      </form>
    </main>
  )
}
```

`app/(auth)/logout/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(richiesta: Request) {
  const db = await supabaseServer()
  await db.auth.signOut()
  return NextResponse.redirect(new URL('/login', richiesta.url))
}
```

- [ ] **Step 7: Scrivere il middleware**

`middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Fa una cosa sola: rinnova il cookie di sessione e manda al login chi non è
 * autenticato. Nessun controllo di ruolo — il vecchio sistema aveva un
 * matcher su /admin/* mentre le pagine stavano sotto /dashboard/admin/*, e il
 * controllo non scattava mai. I ruoli si verificano nelle Server Action e
 * nelle RLS.
 */
const PUBBLICHE = ['/', '/squadre', '/contatti', '/dove-siamo', '/login']

export async function middleware(richiesta: NextRequest) {
  let risposta = NextResponse.next({ request: richiesta })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => richiesta.cookies.getAll(),
        setAll: (elenco) => {
          for (const { name, value } of elenco) richiesta.cookies.set(name, value)
          risposta = NextResponse.next({ request: richiesta })
          for (const { name, value, options } of elenco) risposta.cookies.set(name, value, options)
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const percorso = richiesta.nextUrl.pathname
  const pubblica = PUBBLICHE.includes(percorso)

  if (!user && !pubblica) {
    const destinazione = richiesta.nextUrl.clone()
    destinazione.pathname = '/login'
    return NextResponse.redirect(destinazione)
  }
  if (user && percorso === '/login') {
    const destinazione = richiesta.nextUrl.clone()
    destinazione.pathname = '/gestione'
    return NextResponse.redirect(destinazione)
  }
  return risposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
```

- [ ] **Step 8: Scrivere lo script di seed per lo sviluppo**

`scripts/seed-dev.ts`:
```ts
/**
 * Dati minimi per sviluppo ed E2E. Idempotente: rieseguibile senza duplicare.
 * Uso: npm run seed:dev
 */
import { loadEnvFile } from 'node:process'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Eseguito a mano da terminale, dove le variabili non sono nell'ambiente:
// stesso schema di vitest.db.config.ts. In CI arrivano dal workflow.
try { loadEnvFile('.env.local') } catch { /* in CI le variabili sono già nell'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const UTENTI = [
  { email: 'admin@virpol.test', ruolo: 'admin' as const },
  { email: 'dirigente@virpol.test', ruolo: 'dirigente' as const },
  { email: 'mister@virpol.test', ruolo: 'allenatore' as const },
]

async function main() {
  const db = supabaseAdmin()

  const { data: stagioneEsistente } = await db
    .from('stagioni').select('id').eq('codice', '2026-27').maybeSingle()
  const stagioneId = stagioneEsistente?.id ?? (
    await db.from('stagioni').insert({
      codice: '2026-27', etichetta: '2026/2027',
      data_inizio: '2026-09-01', data_fine: '2027-06-30',
    }).select('id').single()
  ).data!.id

  const { data: esistenti } = await db.auth.admin.listUsers()
  for (const utente of UTENTI) {
    let id = esistenti.users.find((u) => u.email === utente.email)?.id
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email: utente.email, password: PASSWORD, email_confirm: true,
      })
      if (error) throw error
      id = data.user.id
    }

    let personaId: string | null = null
    if (utente.ruolo === 'allenatore') {
      const { data: persona } = await db
        .from('persone').select('id').eq('email', utente.email).maybeSingle()
      personaId = persona?.id ?? (
        await db.from('persone').insert({
          nome: 'Mister', cognome: 'Prova', data_nascita: '1980-01-01', email: utente.email,
        }).select('id').single()
      ).data!.id
    }

    await db.from('profili').upsert({ id, ruolo: utente.ruolo, persona_id: personaId })
    console.log(`profilo pronto: ${utente.email} (${utente.ruolo})`)
  }
  console.log(`stagione pronta: 2026-27 (${stagioneId})`)
  console.log(`password per tutti: ${PASSWORD}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

Aggiungere a `package.json`:
```json
"seed:dev": "npx tsx scripts/seed-dev.ts"
```
e installare l'esecutore: `npm i -D tsx`.

**Ordine dei comandi, che non è indifferente.** Il seed crea la stagione `2026-27`, e i test sul database usano lo stesso codice: girano dentro `inRollback` e non collidono fra loro, ma collidono col seed, che invece committa. La sequenza corretta è sempre `db:reset` prima di `test:db`, e `seed:dev` solo dopo aver finito con i test — mai il contrario.

- [ ] **Step 9: Configurare Playwright e scrivere l'E2E di accesso**

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

`e2e/accesso.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

test('un utente non autenticato che apre il backoffice finisce sul login', async ({ page }) => {
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Accesso' })).toBeVisible()
})

test('credenziali errate mostrano un messaggio e non fanno entrare', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill('sbagliata')
  await page.getByRole('button', { name: 'Entra' }).click()
  // Next inserisce un proprio route-announcer con role="alert": senza filtro
  // il selettore è ambiguo e Playwright falla in strict mode.
  await expect(
    page.getByRole('alert').filter({ hasText: /non corretti/i }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('l\'admin accede e viene portato sulla stagione corrente', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
})

test('chi è già autenticato non vede il login', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/2026-27$/)
})
```

Il terzo e il quarto test dipendono dal redirect alla stagione corrente, che arriva nel Task 12. Fino ad allora falliscono: è la loro condizione di partenza.

- [ ] **Step 10: Eseguire gli E2E disponibili**

```bash
npm run db:reset && npm run seed:dev
npm run test:e2e -- --grep "non autenticato|errate"
```
Expected: PASS, 2 test.

Run: `npm run test:e2e`
Expected: FAIL sui due test che richiedono `/gestione` (non esiste ancora). Sono la specifica del Task 12.

- [ ] **Step 11: Aggiungere gli E2E alla CI**

In `.github/workflows/ci.yml`, aggiungere un terzo job:
```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset
      - name: Variabili dall'istanza locale
        run: |
          echo "NEXT_PUBLIC_SUPABASE_URL=$(supabase status -o env | grep API_URL | cut -d= -f2- | tr -d '\"')" >> $GITHUB_ENV
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '\"')" >> $GITHUB_ENV
          echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '\"')" >> $GITHUB_ENV
          echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> $GITHUB_ENV
      - run: npm run seed:dev
      - run: npm run test:e2e
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: accesso, uscita, middleware e traduzione degli errori del database

Il middleware rinnova il cookie di sessione e reindirizza al login: nessun
controllo di ruolo, che nel vecchio sistema stava su un matcher sbagliato e
non scattava mai. I ruoli si verificano nelle Server Action e nelle RLS.

eseguiAzione trasforma i fallimenti previsti in Risultato e lascia
propagare i bug veri verso error.tsx. traduciErrorePostgres mappa i vincoli
su messaggi in italiano in un punto solo: senza, l'utente leggerebbe
duplicate key value violates unique constraint.

Due E2E restano rossi di proposito: sono la specifica del prossimo task."
```

---

### Task 12: Shell del backoffice e navigazione per stagione

**Files:**
- Create: `lib/repos/stagioni.ts`
- Create: `app/(app)/layout.tsx`, `app/(app)/gestione/page.tsx`
- Create: `app/(app)/[stagione]/layout.tsx`, `app/(app)/[stagione]/page.tsx`
- Create: `components/layout/NavBackoffice.tsx`, `components/layout/SelettoreStagione.tsx`
- Create: `tests/db/repo-stagioni.test.ts`
- Modify: `e2e/accesso.spec.ts` (i due test rossi passano), `e2e/stagioni.spec.ts` (nuovo)

**Interfaces:**
- Consumes: `supabaseServer`, `getSessione`, `Db`
- Produces:
  - `elencaStagioni(db: Db): Promise<Stagione[]>`
  - `stagioneCorrente(db: Db): Promise<Stagione | null>` — prima con `stato = 'aperta'` per `data_inizio DESC`
  - `stagionePerCodice(db: Db, codice: string): Promise<Stagione | null>`
  - `type Stagione = { id: string; codice: string; etichetta: string; dataInizio: string; dataFine: string; stato: 'aperta' | 'chiusa' }`

- [ ] **Step 1: Scrivere i test del repository**

`tests/db/repo-stagioni.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { elencaStagioni, stagioneCorrente, stagionePerCodice } from '@/lib/repos/stagioni'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } })

beforeEach(async () => {
  await db.from('stagioni').delete().neq('codice', '')
})

async function inserisci(
  codice: string, dataInizio: string, stato: 'aperta' | 'chiusa' = 'aperta',
) {
  const { error } = await db.from('stagioni').insert({
    codice,
    etichetta: etichettaDaCodice(codice),
    data_inizio: dataInizio,
    data_fine: `${Number(dataInizio.slice(0, 4)) + 1}-06-30`,
    stato,
  })
  if (error) throw error
}

describe('stagioneCorrente', () => {
  it('restituisce null quando non ci sono stagioni', async () => {
    expect(await stagioneCorrente(db)).toBeNull()
  })

  it('sceglie la stagione aperta più recente per data di inizio', async () => {
    await inserisci('2025-26', '2025-09-01')
    await inserisci('2026-27', '2026-09-01')
    expect((await stagioneCorrente(db))?.codice).toBe('2026-27')
  })

  it('ignora le stagioni chiuse', async () => {
    await inserisci('2025-26', '2025-09-01', 'aperta')
    await inserisci('2026-27', '2026-09-01', 'chiusa')
    expect((await stagioneCorrente(db))?.codice).toBe('2025-26')
  })

  it('restituisce null se tutte le stagioni sono chiuse', async () => {
    await inserisci('2025-26', '2025-09-01', 'chiusa')
    expect(await stagioneCorrente(db)).toBeNull()
  })
})

describe('stagionePerCodice', () => {
  it('trova la stagione', async () => {
    await inserisci('2026-27', '2026-09-01')
    expect((await stagionePerCodice(db, '2026-27'))?.etichetta).toBe('2026/2027')
  })

  it('restituisce null per un codice inesistente', async () => {
    expect(await stagionePerCodice(db, '1999-00')).toBeNull()
  })
})

describe('elencaStagioni', () => {
  it('ordina dalla più recente alla più vecchia', async () => {
    await inserisci('2024-25', '2024-09-01')
    await inserisci('2026-27', '2026-09-01')
    await inserisci('2025-26', '2025-09-01')
    expect((await elencaStagioni(db)).map((s) => s.codice)).toEqual([
      '2026-27', '2025-26', '2024-25',
    ])
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- repo-stagioni`
Expected: FAIL — `Failed to resolve import "@/lib/repos/stagioni"`.

- [ ] **Step 3: Implementare il repository**

`lib/repos/stagioni.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>
type Riga = Database['public']['Tables']['stagioni']['Row']

export type Stagione = {
  id: string
  codice: string
  etichetta: string
  dataInizio: string
  dataFine: string
  stato: 'aperta' | 'chiusa'
}

const CAMPI = 'id, codice, etichetta, data_inizio, data_fine, stato'

function daRiga(r: Pick<Riga, 'id' | 'codice' | 'etichetta' | 'data_inizio' | 'data_fine' | 'stato'>): Stagione {
  return {
    id: r.id,
    codice: r.codice,
    etichetta: r.etichetta,
    dataInizio: r.data_inizio,
    dataFine: r.data_fine,
    stato: r.stato,
  }
}

export async function elencaStagioni(db: Db): Promise<Stagione[]> {
  const { data, error } = await db.from('stagioni').select(CAMPI).order('data_inizio', { ascending: false })
  if (error) throw error
  return data.map(daRiga)
}

/**
 * Stagione corrente: la prima aperta ordinata per data di inizio decrescente.
 * Derivata e non memorizzata — a luglio, con la stagione nuova già aperta e la
 * precedente non ancora chiusa, restituisce quella nuova.
 */
export async function stagioneCorrente(db: Db): Promise<Stagione | null> {
  const { data, error } = await db
    .from('stagioni').select(CAMPI)
    .eq('stato', 'aperta')
    .order('data_inizio', { ascending: false })
    .limit(1).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}

export async function stagionePerCodice(db: Db, codice: string): Promise<Stagione | null> {
  const { data, error } = await db.from('stagioni').select(CAMPI).eq('codice', codice).maybeSingle()
  if (error) throw error
  return data ? daRiga(data) : null
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm run test:db -- repo-stagioni`
Expected: PASS, 7 test.

- [ ] **Step 5: Scrivere il layout del backoffice**

`app/(app)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { NavBackoffice } from '@/components/layout/NavBackoffice'
import { getSessione } from '@/lib/auth/session'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function LayoutBackoffice({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  if (!sessione) redirect('/login')

  const stagioni = await elencaStagioni(db)

  return (
    <div className="min-h-dvh bg-neutral-50">
      <NavBackoffice ruolo={sessione.ruolo} stagioni={stagioni} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  )
}
```

`app/(app)/gestione/page.tsx`:
```tsx
import { notFound, redirect } from 'next/navigation'
import { stagioneCorrente } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Punto di ingresso del backoffice. Non può stare in `(app)/page.tsx`:
 * risolverebbe a `/` come `(public)/page.tsx` e Next rifiuta due pagine
 * parallele sullo stesso percorso.
 */
export default async function IngressoBackoffice() {
  const db = await supabaseServer()
  const corrente = await stagioneCorrente(db)
  if (!corrente) notFound()
  redirect(`/${corrente.codice}`)
}
```

- [ ] **Step 6: Scrivere il layout della stagione**

`app/(app)/[stagione]/layout.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { SelettoreStagione } from '@/components/layout/SelettoreStagione'
import { elencaStagioni, stagionePerCodice } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function LayoutStagione({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ stagione: string }>
}) {
  const { stagione: codice } = await params
  const db = await supabaseServer()
  const stagione = await stagionePerCodice(db, codice)
  if (!stagione) notFound()

  const stagioni = await elencaStagioni(db)
  const solaLettura = stagione.stato === 'chiusa'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SelettoreStagione stagioni={stagioni} corrente={stagione.codice} />
        {solaLettura && (
          <p className="rounded bg-amber-100 px-3 py-1 text-sm text-amber-900">
            Stagione chiusa: dati in sola lettura
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
```

`app/(app)/[stagione]/page.tsx` (segnaposto; il cruscotto scadenze arriva nel piano 3):
```tsx
import { etichettaDaCodice } from '@/lib/domain/stagione'

export default async function Cruscotto({ params }: { params: Promise<{ stagione: string }> }) {
  const { stagione } = await params
  return (
    <section>
      <h1 className="text-xl font-semibold">Stagione {etichettaDaCodice(stagione)}</h1>
      <p className="mt-2 text-neutral-600">
        Il cruscotto delle scadenze arriva con la gestione delle quote.
      </p>
    </section>
  )
}
```

- [ ] **Step 7: Scrivere navigazione e selettore**

`components/layout/SelettoreStagione.tsx`:
```tsx
'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import type { Stagione } from '@/lib/repos/stagioni'

/** Cambia solo il segmento di stagione nell'URL: nessuno stato globale. */
export function SelettoreStagione({
  stagioni,
  corrente,
}: {
  stagioni: Stagione[]
  corrente: string
}) {
  const router = useRouter()
  const percorso = usePathname()
  const params = useParams<{ stagione: string }>()

  function cambia(codice: string) {
    const attuale = params.stagione
    router.push(percorso.replace(`/${attuale}`, `/${codice}`))
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-600">Stagione</span>
      <select
        value={corrente}
        onChange={(e) => cambia(e.target.value)}
        className="rounded border bg-white px-2 py-1"
      >
        {stagioni.map((s) => (
          <option key={s.codice} value={s.codice}>
            {s.etichetta}{s.stato === 'chiusa' ? ' (chiusa)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
```

`components/layout/NavBackoffice.tsx`:
```tsx
import Link from 'next/link'
import type { RuoloApp } from '@/lib/auth/session'
import type { Stagione } from '@/lib/repos/stagioni'

export function NavBackoffice({ ruolo, stagioni }: { ruolo: RuoloApp; stagioni: Stagione[] }) {
  const corrente = stagioni.find((s) => s.stato === 'aperta') ?? stagioni[0]

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 p-4 text-sm">
        <Link href="/gestione" className="font-semibold">Virpol</Link>
        {corrente && (
          <>
            <Link href={`/${corrente.codice}/squadre`}>Squadre</Link>
            <Link href={`/${corrente.codice}/tesseramenti`}>Tesserati</Link>
            <Link href={`/${corrente.codice}/presenze`}>Presenze</Link>
          </>
        )}
        <Link href="/anagrafica">Anagrafica</Link>
        {ruolo === 'admin' && <Link href="/admin/stagioni">Stagioni</Link>}
        <form action="/logout" method="post" className="ml-auto">
          <button type="submit" className="text-neutral-600 underline">Esci</button>
        </form>
      </nav>
    </header>
  )
}
```

I link a `squadre`, `tesseramenti`, `presenze` e `anagrafica` puntano a pagine che arrivano nei piani 2, 3 e 4: fino ad allora danno 404. È accettabile perché il backoffice non è ancora in uso da nessuno.

- [ ] **Step 8: Scrivere l'E2E della navigazione**

`e2e/stagioni.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

async function accedi(page: import('@playwright/test').Page, email = 'admin@virpol.test') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
}

test('/gestione porta alla stagione corrente', async ({ page }) => {
  await accedi(page)
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/2026-27$/)
  await expect(page.getByRole('heading', { name: 'Stagione 2026/2027' })).toBeVisible()
})

test('un codice stagione inesistente dà 404, non una pagina bianca', async ({ page }) => {
  await accedi(page)
  const risposta = await page.goto('/1999-00')
  expect(risposta?.status()).toBe(404)
})

test('il selettore cambia solo il segmento di stagione', async ({ page }) => {
  await accedi(page)
  await page.goto('/2026-27')
  await expect(page.getByRole('combobox')).toHaveValue('2026-27')
})

test('l\'uscita riporta al login e chiude la sessione', async ({ page }) => {
  await accedi(page)
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 9: Eseguire tutti gli E2E**

```bash
npm run db:reset && npm run seed:dev
npm run test:e2e
```
Expected: PASS — i 4 test di `accesso.spec.ts` (compresi i due che erano rossi) e i 4 di `stagioni.spec.ts`.

- [ ] **Step 10: Verificare lint, tipi e build**

Run: `npm run lint && npm run type-check && npm run build`
Expected: codice 0 per tutti e tre.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: shell del backoffice e navigazione per stagione

La stagione vive nel segmento di URL: il layout la risolve dal parametro di
rotta e fa notFound() se il codice non esiste. Nessun context globale,
nessun flag attiva nel database, e un link condiviso mostra sempre gli
stessi dati.

Il selettore di stagione è l'unico Client Component della shell e sostituisce
solo il segmento nel percorso. Una stagione chiusa mostra l'avviso di sola
lettura; il divieto di scrittura è già nelle RLS."
```

---

### Task 13: Gestione delle stagioni da parte dell'admin

**Files:**
- Create: `app/(app)/admin/stagioni/page.tsx`, `app/(app)/admin/stagioni/actions.ts`
- Create: `components/stagioni/FormStagione.tsx`, `components/stagioni/TabellaStagioni.tsx`
- Modify: `lib/repos/stagioni.ts` (aggiunge `creaStagione`, `cambiaStato`)
- Create: `tests/db/repo-stagioni-scrittura.test.ts`
- Create: `e2e/admin-stagioni.spec.ts`

**Interfaces:**
- Consumes: `elencaStagioni`, `richiediRuolo`, `eseguiAzione`, `traduciErrorePostgres`
- Produces:
  - `creaStagione(db: Db, dati: { codice: string; etichetta: string; dataInizio: string; dataFine: string }): Promise<Stagione>`
  - `cambiaStato(db: Db, id: string, stato: 'aperta' | 'chiusa'): Promise<void>`
  - Server Action `creaStagioneAzione(precedente, form): Promise<Risultato<null>>`
  - Server Action `cambiaStatoAzione(id: string, stato: 'aperta' | 'chiusa'): Promise<Risultato<null>>`

- [ ] **Step 1: Scrivere i test del repository in scrittura**

`tests/db/repo-stagioni-scrittura.test.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import { cambiaStato, creaStagione, elencaStagioni } from '@/lib/repos/stagioni'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const db = createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

beforeEach(async () => {
  await db.from('stagioni').delete().neq('codice', '')
})

const valida = {
  codice: '2026-27', etichetta: '2026/2027',
  dataInizio: '2026-09-01', dataFine: '2027-06-30',
}

describe('creaStagione', () => {
  it('crea una stagione aperta', async () => {
    const creata = await creaStagione(db, valida)
    expect(creata).toMatchObject({ codice: '2026-27', stato: 'aperta' })
  })

  it('propaga l\'errore del vincolo sulla forma del codice', async () => {
    await expect(creaStagione(db, { ...valida, codice: '2026/2027' })).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('propaga l\'errore sul codice duplicato', async () => {
    await creaStagione(db, valida)
    await expect(creaStagione(db, valida)).rejects.toMatchObject({ code: '23505' })
  })

  it('propaga l\'errore sulle date incoerenti', async () => {
    await expect(
      creaStagione(db, { ...valida, dataInizio: '2027-09-01', dataFine: '2026-06-30' }),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('cambiaStato', () => {
  it('chiude e riapre una stagione', async () => {
    const creata = await creaStagione(db, valida)
    await cambiaStato(db, creata.id, 'chiusa')
    expect((await elencaStagioni(db))[0].stato).toBe('chiusa')
    await cambiaStato(db, creata.id, 'aperta')
    expect((await elencaStagioni(db))[0].stato).toBe('aperta')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm run test:db -- repo-stagioni-scrittura`
Expected: FAIL — `creaStagione is not a function`.

- [ ] **Step 3: Aggiungere le funzioni al repository**

In coda a `lib/repos/stagioni.ts`:
```ts
export async function creaStagione(
  db: Db,
  dati: { codice: string; etichetta: string; dataInizio: string; dataFine: string },
): Promise<Stagione> {
  const { data, error } = await db
    .from('stagioni')
    .insert({
      codice: dati.codice,
      etichetta: dati.etichetta,
      data_inizio: dati.dataInizio,
      data_fine: dati.dataFine,
    })
    .select(CAMPI)
    .single()
  if (error) throw error
  return daRiga(data)
}

export async function cambiaStato(
  db: Db,
  id: string,
  stato: 'aperta' | 'chiusa',
): Promise<void> {
  const { error } = await db.from('stagioni').update({ stato }).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm run test:db -- repo-stagioni-scrittura`
Expected: PASS, 5 test.

- [ ] **Step 5: Scrivere le Server Action**

`app/(app)/admin/stagioni/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eseguiAzione, type Risultato } from '@/lib/azioni'
import { richiediRuolo } from '@/lib/auth/session'
import { etichettaDaCodice } from '@/lib/domain/stagione'
import { cambiaStato, creaStagione } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

const schema = z.object({
  codice: z.string().regex(/^\d{4}-\d{2}$/, 'Forma attesa: 2026-27'),
  dataInizio: z.string().min(1, 'Data di inizio obbligatoria'),
  dataFine: z.string().min(1, 'Data di fine obbligatoria'),
})

export async function creaStagioneAzione(
  _precedente: unknown,
  form: FormData,
): Promise<Risultato<null>> {
  const campi = schema.safeParse({
    codice: form.get('codice'),
    dataInizio: form.get('dataInizio'),
    dataFine: form.get('dataFine'),
  })
  if (!campi.success) {
    return {
      ok: false,
      errore: 'Controlla i dati inseriti',
      campi: Object.fromEntries(campi.error.issues.map((i) => [String(i.path[0]), i.message])),
    }
  }

  const esito = await eseguiAzione('stagioni.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])
    await creaStagione(db, {
      codice: campi.data.codice,
      etichetta: etichettaDaCodice(campi.data.codice),
      dataInizio: campi.data.dataInizio,
      dataFine: campi.data.dataFine,
    })
    return null
  })

  if (esito.ok) revalidatePath('/admin/stagioni')
  return esito
}

export async function cambiaStatoAzione(
  id: string,
  stato: 'aperta' | 'chiusa',
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('stagioni.cambiaStato', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])
    await cambiaStato(db, id, stato)
    return null
  })
  if (esito.ok) revalidatePath('/admin/stagioni')
  return esito
}
```

L'etichetta si deriva dal codice con `etichettaDaCodice` del Task 5: `2026-27` diventa `2026/2027`.

- [ ] **Step 6: Scrivere i componenti**

`components/stagioni/FormStagione.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { creaStagioneAzione } from '@/app/(app)/admin/stagioni/actions'

export function FormStagione() {
  const [esito, azione, inCorso] = useActionState(creaStagioneAzione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <form action={azione} className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
      <div>
        <label htmlFor="codice" className="block text-sm font-medium">Codice</label>
        <input id="codice" name="codice" placeholder="2026-27" required
               className="mt-1 rounded border px-2 py-1" />
        {campi?.codice && <p role="alert" className="mt-1 text-sm text-red-700">{campi.codice}</p>}
      </div>
      <div>
        <label htmlFor="dataInizio" className="block text-sm font-medium">Inizio</label>
        <input id="dataInizio" name="dataInizio" type="date" required
               className="mt-1 rounded border px-2 py-1" />
        {campi?.dataInizio && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.dataInizio}</p>
        )}
      </div>
      <div>
        <label htmlFor="dataFine" className="block text-sm font-medium">Fine</label>
        <input id="dataFine" name="dataFine" type="date" required
               className="mt-1 rounded border px-2 py-1" />
        {campi?.dataFine && (
          <p role="alert" className="mt-1 text-sm text-red-700">{campi.dataFine}</p>
        )}
      </div>
      <button type="submit" disabled={inCorso}
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60">
        {inCorso ? 'Creazione…' : 'Crea stagione'}
      </button>
      {/* Il fallback scatta anche quando `campi` esiste ma nessun input ne
          possiede uno: senza questa condizione un errore zod su una data
          non comparirebbe da nessuna parte e il form sembrerebbe non fare
          nulla. */}
      {esito && !esito.ok && !campi?.codice && !campi?.dataInizio && !campi?.dataFine && (
        <p role="alert" className="w-full text-sm text-red-700">{esito.errore}</p>
      )}
    </form>
  )
}
```

`components/stagioni/TabellaStagioni.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import { cambiaStatoAzione } from '@/app/(app)/admin/stagioni/actions'
import type { Stagione } from '@/lib/repos/stagioni'

export function TabellaStagioni({ stagioni }: { stagioni: Stagione[] }) {
  const [inCorso, avvia] = useTransition()

  if (stagioni.length === 0) {
    return (
      <p className="rounded border bg-white p-4 text-neutral-600">
        Nessuna stagione: creane una per iniziare.
      </p>
    )
  }

  return (
    <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
      <thead className="bg-neutral-100 text-left">
        <tr>
          <th className="p-2">Stagione</th>
          <th className="p-2">Periodo</th>
          <th className="p-2">Stato</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {stagioni.map((s) => (
          <tr key={s.id} className="border-t">
            <td className="p-2 font-medium">{s.etichetta}</td>
            <td className="p-2 text-neutral-600">{s.dataInizio} → {s.dataFine}</td>
            <td className="p-2">{s.stato}</td>
            <td className="p-2 text-right">
              <button
                type="button"
                disabled={inCorso}
                onClick={() => avvia(() => {
                  void cambiaStatoAzione(s.id, s.stato === 'aperta' ? 'chiusa' : 'aperta')
                })}
                className="underline disabled:opacity-60"
              >
                {s.stato === 'aperta' ? 'Chiudi' : 'Riapri'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 7: Scrivere la pagina**

`app/(app)/admin/stagioni/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { FormStagione } from '@/components/stagioni/FormStagione'
import { TabellaStagioni } from '@/components/stagioni/TabellaStagioni'
import { getSessione } from '@/lib/auth/session'
import { elencaStagioni } from '@/lib/repos/stagioni'
import { supabaseServer } from '@/lib/supabase/server'

export default async function PaginaStagioni() {
  const db = await supabaseServer()
  const sessione = await getSessione(db)
  if (sessione?.ruolo !== 'admin') redirect('/gestione')

  const stagioni = await elencaStagioni(db)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Stagioni sportive</h1>
      <FormStagione />
      <TabellaStagioni stagioni={stagioni} />
    </section>
  )
}
```

- [ ] **Step 8: Scrivere l'E2E**

`e2e/admin-stagioni.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

**Lo stato condiviso va ripristinato in un hook, non in coda a un test.** Questa suite chiude stagioni, e `stagioneCorrente` è derivata: chiudere `2026-27` la fa smettere di essere corrente, e i test di `accesso.spec.ts` e `stagioni.spec.ts` asseriscono che il login arrivi proprio lì. Playwright gira con `workers: 1`, quindi l'ordine è deterministico, ma l'ordine non è il problema — lo è il fallimento.

Una compensazione scritta in coda al test che ha chiuso la stagione non viene eseguita se un'assertion precedente lancia. Il risultato è che gli altri file falliscono per uno stato che nessuno ha ripristinato, e l'evidenza punta al file sbagliato. Il ripristino va quindi in un `test.afterAll` che rimette il mondo a posto — `2026-27` aperta — perché quello gira anche quando il test che avrebbe dovuto compensare è morto a metà.

```ts
test.afterAll(async ({ browser }) => {
  const pagina = await browser.newPage()
  await accedi(pagina, 'admin@virpol.test')
  await pagina.goto('/admin/stagioni')
  const riga = pagina.getByRole('row').filter({ hasText: '2026/2027' })
  const riapri = riga.getByRole('button', { name: 'Riapri' })
  if (await riapri.isVisible()) await riapri.click()
  await pagina.close()
})
```

La prova che sia davvero a prova di crash non è che i test passino: è far fallire un'assertion di proposito e verificare che il ripristino sia avvenuto comunque.

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  // L'attesa è obbligatoria: il redirect è lato client, e senza questa il
  // test procede mentre la navigazione è ancora in volo.
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

test('l\'admin crea una stagione e la vede in elenco', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2027-28')
  await page.getByLabel('Inizio').fill('2027-09-01')
  await page.getByLabel('Fine').fill('2028-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  await expect(page.getByRole('cell', { name: '2027/2028' })).toBeVisible()
})

test('un codice malformato mostra un messaggio accanto al campo', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2027/2028')
  await page.getByLabel('Inizio').fill('2027-09-01')
  await page.getByLabel('Fine').fill('2028-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '2026-27' }),
  ).toBeVisible()
})

test('un codice già esistente mostra il messaggio tradotto, non l\'errore Postgres', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2026-27')
  await page.getByLabel('Inizio').fill('2026-09-01')
  await page.getByLabel('Fine').fill('2027-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  const avviso = page.getByRole('alert').filter({ hasText: /già una stagione/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('chiudere una stagione la mette in sola lettura', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  // Localizzare la RIGA di 2026-27, non usare .first(): in elenco possono
  // esserci altre stagioni già chiuse, e `.first()` intercetterebbe una di
  // quelle. L'assertion passerebbe prima che 2026-27 sia davvero chiusa, e il
  // fallimento emergerebbe in un test diverso — un verde che rompe altro.
  const riga = page.getByRole('row').filter({ hasText: '2026/2027' })
  await riga.getByRole('button', { name: 'Chiudi' }).click()
  await expect(riga.getByRole('cell', { name: 'chiusa' })).toBeVisible()
  await page.goto('/2026-27')
  await expect(page.getByText('Stagione chiusa: dati in sola lettura')).toBeVisible()
})

test('un dirigente non entra nella gestione stagioni', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/admin/stagioni')
  await expect(page).toHaveURL(/\/2026-27$/)
})
```

- [ ] **Step 9: Eseguire tutta la suite**

```bash
npm run db:reset && npm run seed:dev
npm run test:unit && npm run test:db && npm run test:e2e
npm run lint && npm run type-check && npm run build
```
Expected: tutto verde.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: gestione delle stagioni sportive per l'admin

Crea, chiudi e riapri stagioni. L'azione verifica il ruolo con
richiediRuolo e le RLS lo verificano di nuovo: la prima dà un messaggio
leggibile, la seconda regge se un'azione futura dimentica il controllo.

Un E2E verifica che un codice duplicato mostri il messaggio tradotto e non
la stringa duplicate key: è il caso che l'utente incontra per primo e la
ragione per cui esiste lib/errors/postgres.ts."
```

---

## Fine del piano 1

Alla fine di questi 13 task esiste un'applicazione che:

- ha lo schema completo, 10 tabelle e 2 view, con i vincoli coperti da test
- ha la matrice RLS coperta in permesso **e** in diniego, per tre ruoli e per l'utente anonimo
- fa accedere admin, dirigente e allenatore, e li riporta al login all'uscita
- naviga per stagione con l'URL come unica fonte di verità
- consente all'admin di creare, chiudere e riaprire stagioni
- ha CI con lint, type-check, test unitari, test sul database, E2E e build

Non ha ancora anagrafica, squadre, tesseramenti, quote, presenze, statistiche né sito pubblico: sono i piani 2–5. La migrazione dei dati è il piano 6 e dipende solo dallo schema, quindi può essere scritta in parallelo.

## Self-review del piano

**Copertura dello spec (traguardi A, B, C):**

| Requisito dello spec | Task |
|---|---|
| §2 stack e data layer | 1, 10 |
| §3 tabella `persone`, `profili` | 4 |
| §3 `stagioni`, `squadre`, vincolo sulla forma del codice | 5 |
| §3 `tesseramenti`, `incarichi_staff`, FK composite, indice parziale maglia | 6 |
| §3 `quote_importi`, `pagamenti_quota`, `v_quote` | 7 |
| §3 `sedute_allenamento`, `presenze`, `v_presenze` | 8 |
| §3 stato visita calcolato dalla scadenza | 6 (colonne e indice), consumo nel piano 3 |
| §3 stagione corrente derivata | 12 |
| §4 gruppi di rotte, `(app)/gestione` | 11, 12 |
| §4 regola sulla non duplicazione della logica | 7, 8 (view come unica implementazione) |
| §5 lettura nei Server Component, scrittura nelle Server Action | 12, 13 |
| §6 funzioni `app.*` con `search_path` vuoto | 9 |
| §6 matrice delle policy, `USING` + `WITH CHECK`, stagione aperta solo in scrittura | 9 |
| §6 nessun controllo di ruolo nel middleware | 11 |
| §6 `richiediRuolo` nelle azioni | 13 |
| §6 divieto di importare `admin.ts` da `app/` | 3 |
| §6 `.env.example` con soli segnaposto | 1 |
| §7 `Risultato<T>`, nessuna eccezione per i fallimenti previsti | 11 |
| §7 traduzione dei codici Postgres | 11 |
| §7 `lib/env.ts` che fa fallire la build e l'avvio | 2 |
| §7 log senza dati personali | 10 |
| §7 `notFound()` su codice stagione inesistente | 12 |
| §8 Vitest unit, Vitest + Postgres, Playwright, CI | 2, 4, 11 |
| §8 invariante "l'allenatore di A non legge né scrive su B" | 9 |

Requisiti dello spec **non** coperti da questo piano, perché appartengono a traguardi successivi: `loading.tsx` con skeleton per rotta (piani 2–4, quando esistono pagine con dati), rollback ottimistico del foglio presenze (piano 4), cruscotto scadenze (piano 3), sito pubblico (piano 5), script di migrazione e cutover (piano 6).

**Verifiche di coerenza risolte durante la stesura:**

1. `lib/supabase/admin.ts` serve già al Task 3 come bersaglio della regola ESLint, ma la sua implementazione dipende dai tipi generati al Task 10. Risolto con una firma segnaposto al Task 3, sostituita al Task 10.
2. I test del Task 10 e successivi non possono usare l'isolamento a rollback dell'harness, perché creano utenti Auth tramite API: usano email casuali e, dove serve, ripuliscono con `beforeEach`.
3. `eseguiAzione` non conosceva `CredenzialiNonValide` e l'avrebbe rilanciata come bug: la gestione è aggiunta nello stesso task che introduce l'errore (Task 11, Step 6).
4. Due E2E del Task 11 dipendono da `/gestione`, creato nel Task 12: restano rossi di proposito e sono dichiarati come specifica del task successivo.
5. L'etichetta della stagione serve in tre punti: l'azione di creazione (Task 13), l'harness dei test (Task 5) e i dati di prova del repository (Task 12). La prima stesura usava `codice.replace('-', '/')` nei test, che produce `2026/27`, e una formula diversa nell'azione, che produce `2026/2027`: i test avrebbero validato un formato che l'applicazione non genera mai. Ora la formula esiste una volta sola, in `lib/domain/stagione.ts`, con un test che ne fissa anche il comportamento a cavallo di secolo.
6. `traduciErrorePostgres` mappa i nomi dei vincoli generati da Postgres per le UNIQUE dichiarate inline (`tesseramenti_persona_id_stagione_id_key`, `squadre_stagione_id_nome_key`, `presenze_seduta_id_tesseramento_id_key`). Se durante il Task 6 o 8 si scegliesse di nominare esplicitamente quei vincoli, va aggiornata la mappa: il test del Task 11 usa gli stessi nomi e fallirebbe, quindi la divergenza non passa inosservata.
