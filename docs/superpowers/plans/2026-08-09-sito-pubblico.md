# Sito pubblico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le quattro pagine pubbliche — home, squadre, contatti, dove siamo — con il contenuto e l'impostazione visiva del sito vecchio, ricostruite come Server Component; le squadre escono dal database attraverso una view pubblica.

**Architecture:** tutto nel gruppo di rotta `(public)` con un layout proprio (header + footer). Tre pagine sono statiche pure; `/squadre` legge `public.v_squadre_pubbliche` — l'unica view non `security_invoker` del repo, recintata a tre colonne e alla stagione corrente, con grant ad `anon` — attraverso un client anonimo senza cookie, così la pagina resta statica con `revalidate`.

**Tech Stack:** invariato. Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-08-09-sito-pubblico-design.md`

## Global Constraints

Valgono tutte quelle di `CLAUDE.md`. Sotto pressione qui:

- **Niente service role, niente `supabaseServer` nelle pagine pubbliche.** `supabaseServer` legge i cookie e renderebbe la rotta dinamica: le pagine pubbliche usano il client anonimo di `lib/supabase/pubblico.ts` (Task 2) o niente.
- **La regola «stagione corrente» vive nello SQL della view** — `stato = 'aperta'`, `data_inizio desc`, spareggio `codice desc`, la stessa di `stagioneCorrenteDa` — non in TypeScript.
- **La view espone solo `nome`, `categoria`, `annata`.** Mai `note`, mai gli id.
- **Il contenuto si ricopia dal sito vecchio, non si inventa.** Fonti: `~/Progetti/virpolcampogalliano/app/page.tsx` (791 righe), `contatti/page.tsx` (387), `dove-siamo/page.tsx` (329). Testi, recapiti, numeri e sezioni restano quelli; le animazioni client (scroll JS, `animate-pulse`, contatori) no. In caso di dubbio su un contenuto: si copia, non si riscrive.
- **Nessuna pagina sopra le ~150 righe** (la home vecchia ne ha 791: l'obiettivo è ~80-120 server-side; se serve, si estraggono componenti presentazionali in `components/pubblico/`).
- Nomi e testi in italiano; parole chiave tecniche in inglese.
- Commit: prefisso convenzionale inglese, corpo italiano che spiega perché.
- Ordine dei test: `db:reset && test:db && test:unit`, poi `seed:dev && test:e2e`, poi `lint && type-check && build`.

## File Structure

| File | Responsabilità |
|---|---|
| `supabase/migrations/20260809000100_sito_pubblico.sql` | la view e i suoi grant |
| `lib/supabase/pubblico.ts` | client anonimo senza cookie, per le pagine statiche |
| `app/(public)/layout.tsx` | header (logo, nav, Accedi) + footer pubblici |
| `app/(public)/page.tsx` | home: hero, numeri, chi siamo |
| `app/(public)/squadre/page.tsx` | elenco dalla view, `revalidate = 3600` |
| `app/(public)/contatti/page.tsx` | statica |
| `app/(public)/dove-siamo/page.tsx` | statica |
| `components/pubblico/*` | sezioni estratte se una pagina supera le ~150 righe |
| `public/images/home/` | `virpol-logo.png`, `hero-background.jpg` copiati dal vecchio |
| `tests/db/sito-pubblico.test.ts` | contenuto e privilegi della view |
| `tests/db/rls.test.ts` | la view nuova entra nella matrice, deliberatamente |
| `e2e/sito-pubblico.spec.ts` | le 4 pagine senza sessione |

## Fatti verificati

- Seed: due squadre `Pulcini A` e `Pulcini B`, categoria `Pulcini`, annata 2015, nella stagione corrente del seed.
- `tests/db/rls.test.ts` legge i privilegi da `pg_class.relacl` e tiene un elenco esplicito `const VISTE = ['v_presenze', 'v_presenze_squadra', 'v_quote', 'v_visite']` (riga ~462): la view nuova va aggiunta lì con i privilegi attesi. **Questo è il caso in cui aggiornare l'atteso è giusto**: il grant ad anon è la feature, documentata nella spec — non è la trappola del «non aggiornare l'atteso per far passare», che riguarda i grant NON voluti.
- Il sito vecchio usa due sole immagini: `/images/home/virpol-logo.png` e `/images/home/hero-background.jpg`.
- L'unico gruppo `(public)` esistente ha una `page.tsx` segnaposto di 8 righe («Sito in ricostruzione»), nessun layout.
- Root layout (`app/layout.tsx`) porta già font e `metadata` di base: il layout pubblico NON ridefinisce `<html>`/`<body>`.

---

## Task 1: La view `v_squadre_pubbliche` e i suoi privilegi

**Files:**
- Create: `supabase/migrations/20260809000100_sito_pubblico.sql`
- Create: `tests/db/sito-pubblico.test.ts`
- Modify: `tests/db/rls.test.ts` (elenco `VISTE` + privilegi attesi della view nuova)

**Interfaces:**
- Produces: `public.v_squadre_pubbliche` → `(nome text, categoria text, annata integer)`, sola stagione corrente, leggibile da `anon` e `authenticated`.

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/db/sito-pubblico.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { asAnon, inRollback } from './harness'

/**
 * v_squadre_pubbliche è l'unica view non security_invoker del repo: serve
 * anon, che sulle tabelle non ha diritti. Il recinto sta nella definizione
 * (tre colonne, sola stagione corrente) e nel grant. Questi test lo tengono.
 */
describe('v_squadre_pubbliche', () => {
  it('espone le squadre della sola stagione corrente, con le sole tre colonne', () =>
    inRollback(async (c) => {
      await c.query(`
        insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato) values
        ('2098-99', 'Vecchia', '2098-09-01', '2099-06-30', 'chiusa'),
        ('2099-00', 'Corrente', '2099-09-01', '2100-06-30', 'aperta')
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria, annata)
        select id, 'Pubblica', 'Esordienti', 2088 from public.stagioni where codice = '2099-00'
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Fantasma', 'Esordienti' from public.stagioni where codice = '2098-99'
      `)

      const { rows } = await asAnon(c, () =>
        c.query(`select * from public.v_squadre_pubbliche where nome in ('Pubblica', 'Fantasma')`),
      )
      expect(rows).toEqual([{ nome: 'Pubblica', categoria: 'Esordienti', annata: 2088 }])
    }))

  it('a parità di data vince il codice più alto, come stagioneCorrenteDa', () =>
    inRollback(async (c) => {
      await c.query(`
        insert into public.stagioni (codice, etichetta, data_inizio, data_fine, stato) values
        ('2099-00', 'Prima', '2099-09-01', '2100-06-30', 'aperta'),
        ('2100-01', 'Seconda', '2099-09-01', '2100-06-30', 'aperta')
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Vincente', 'Pulcini' from public.stagioni where codice = '2100-01'
      `)
      await c.query(`
        insert into public.squadre (stagione_id, nome, categoria)
        select id, 'Perdente', 'Pulcini' from public.stagioni where codice = '2099-00'
      `)
      const { rows } = await asAnon(c, () =>
        c.query(`select nome from public.v_squadre_pubbliche where nome in ('Vincente', 'Perdente')`),
      )
      expect(rows).toEqual([{ nome: 'Vincente' }])
    }))

  it('anon legge la view ma continua a non leggere le tabelle', () =>
    inRollback(async (c) => {
      await expect(
        asAnon(c, () => c.query('select nome from public.squadre limit 1')),
      ).rejects.toThrow(/permission denied/i)
      await expect(
        asAnon(c, () => c.query('select codice from public.stagioni limit 1')),
      ).rejects.toThrow(/permission denied/i)
    }))

  it('senza stagioni aperte la view è vuota, non rotta', () =>
    inRollback(async (c) => {
      await c.query(`update public.stagioni set stato = 'chiusa'`)
      const { rows } = await asAnon(c, () => c.query('select * from public.v_squadre_pubbliche'))
      expect(rows).toEqual([])
    }))
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:db -- sito-pubblico`
Expected: FAIL, `relation "public.v_squadre_pubbliche" does not exist`.

- [ ] **Step 3: Scrivere la migration**

Crea `supabase/migrations/20260809000100_sito_pubblico.sql`:

```sql
-- Le squadre per il sito pubblico. UNICA view del repo senza
-- security_invoker, ed è il punto: serve anon, che sulle tabelle non ha
-- alcun diritto. Come view di proprietà di postgres legge stagioni e
-- squadre coi diritti del proprietario; il recinto sta nella definizione
-- — tre colonne, sola stagione corrente — e nel grant qui sotto.
--
-- La regola «stagione corrente» è la stessa di stagioneCorrenteDa in
-- lib/domain/stagione.ts: prima aperta per data_inizio, spareggio sul
-- codice. Se cambia lì, cambia anche qui.
create view public.v_squadre_pubbliche as
  with corrente as (
    select id
    from public.stagioni
    where stato = 'aperta'
    order by data_inizio desc, codice desc
    limit 1
  )
  select s.nome, s.categoria, s.annata
  from public.squadre s
  join corrente c on c.id = s.stagione_id
  order by s.categoria, s.nome;

comment on view public.v_squadre_pubbliche is
  'Sito pubblico: nome, categoria e annata delle squadre della stagione '
  'corrente. Unica view non security_invoker: anon la legge, le tabelle no.';

grant select on public.v_squadre_pubbliche to anon, authenticated;
```

- [ ] **Step 4: Applicare, rigenerare i tipi, verificare il verde**

```bash
npm run db:reset && npm run db:types && npm run test:db -- sito-pubblico
```
Expected: 4 test verdi. `lib/db/types.ts` guadagna la view sotto `Views`.

- [ ] **Step 5: La matrice RLS impara la view, deliberatamente**

Run: `npm run test:db -- rls`
Se rosso perché la view nuova compare nei privilegi: aggiungi
`'v_squadre_pubbliche'` all'elenco `VISTE` in `tests/db/rls.test.ts` e i
privilegi attesi (select per `anon` e `authenticated`, nient'altro), con un
commento di una riga che rimanda alla spec del sito pubblico. **Questo è
l'aggiornamento giusto dell'atteso: il grant è la feature.** Qualunque ALTRA
differenza nella matrice è una regressione da capire, non da assorbire.
Expected finale: `npm run test:db -- rls` verde.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260809000100_sito_pubblico.sql tests/db/sito-pubblico.test.ts tests/db/rls.test.ts lib/db/types.ts
git commit -m "feat(db): v_squadre_pubbliche, la vetrina per anon"
```

---

## Task 2: Client anonimo, layout pubblico e home

**Files:**
- Create: `lib/supabase/pubblico.ts`
- Create: `app/(public)/layout.tsx`
- Modify: `app/(public)/page.tsx` (via il segnaposto)
- Create: `public/images/home/virpol-logo.png`, `public/images/home/hero-background.jpg` (copiati)
- Create: `components/pubblico/*` se la home supera le ~150 righe

**Interfaces:**
- Produces: `clientPubblico(): SupabaseClient<Database>` (anonimo, senza cookie); layout con nav verso `/`, `/squadre`, `/contatti`, `/dove-siamo` e link `Accedi` → `/login`.

- [ ] **Step 1: Il client anonimo**

Crea `lib/supabase/pubblico.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

/**
 * Client anonimo per le pagine pubbliche statiche. Niente cookie e niente
 * sessione: supabaseServer passa da cookies() e renderebbe la rotta
 * dinamica, rompendo il revalidate. La chiave anon è pubblica per natura
 * (viaggia in ogni bundle browser): qui non c'è nulla da recintare.
 */
export function clientPubblico() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

- [ ] **Step 2: Copiare gli asset**

```bash
mkdir -p public/images/home
cp ~/Progetti/virpolcampogalliano/public/images/home/virpol-logo.png public/images/home/
cp ~/Progetti/virpolcampogalliano/public/images/home/hero-background.jpg public/images/home/
```

- [ ] **Step 3: Il layout pubblico**

Crea `app/(public)/layout.tsx` ricostruendo header e footer del sito vecchio
(sono dentro `~/Progetti/virpolcampogalliano/app/page.tsx` e ripetuti nelle
altre pagine: estraili una volta qui). Contenuto: logo + nome società,
nav alle quattro pagine, link `Accedi` verso `/login`; footer con recapiti e
riferimenti presenti nel sito vecchio. Server Component puro, niente
`'use client'`. Non ridefinire `<html>`/`<body>`: quelli stanno nel root
layout.

- [ ] **Step 4: La home**

Riscrivi `app/(public)/page.tsx` portando dal vecchio `app/page.tsx` le tre
sezioni — hero (titolo, sottotitolo, sfondo `hero-background.jpg`, bottoni),
«I nostri numeri» (le quattro cifre e le etichette, testo statico al posto
dei contatori animati), «Chi siamo» (testi integrali) — con la stessa
gerarchia visiva Tailwind. Cade tutto ciò che è client: `'use client'`,
`scrollToSection` (gli anchor `#chi-siamo` funzionano da soli),
`animate-pulse`, contatori JS. Budget ~80-120 righe: se non bastano, estrai
le sezioni in `components/pubblico/Hero.tsx`, `Numeri.tsx`, `ChiSiamo.tsx`
(sempre server). Aggiungi `export const metadata` con title e description
presi dal sito vecchio.

- [ ] **Step 5: Verifica**

```bash
npm run lint && npm run type-check && npm run build
```
Expected: puliti; nel riepilogo del build `/` risulta statica (`○`).
Poi `npm run dev` e controllo visivo della home a `http://localhost:3000`
(hero con sfondo, numeri, chi siamo, header e footer). Chiudi il dev server.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/pubblico.ts "app/(public)" public/images components/pubblico 2>/dev/null || git add lib/supabase/pubblico.ts "app/(public)" public/images
git commit -m "feat(pubblico): layout e home, dal client al server"
```

---

## Task 3: Squadre, contatti e dove siamo

**Files:**
- Create: `app/(public)/squadre/page.tsx`
- Create: `app/(public)/contatti/page.tsx`
- Create: `app/(public)/dove-siamo/page.tsx`

**Interfaces:**
- Consumes: `clientPubblico` (Task 2), `v_squadre_pubbliche` (Task 1).

- [ ] **Step 1: La pagina squadre**

Crea `app/(public)/squadre/page.tsx`:

```tsx
import { clientPubblico } from '@/lib/supabase/pubblico'

export const revalidate = 3600

export const metadata = {
  title: 'Squadre — Virpol Campogalliano',
  description: 'Le squadre della stagione in corso.',
}

export default async function PaginaSquadre() {
  const { data, error } = await clientPubblico()
    .from('v_squadre_pubbliche')
    .select('nome, categoria, annata')
  if (error) throw error
  const squadre = data ?? []

  const categorie = [...new Set(squadre.map((s) => s.categoria))]

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Le nostre squadre</h1>
      {squadre.length === 0 ? (
        <p className="mt-6 text-neutral-600">
          Le squadre della nuova stagione sono in preparazione.
        </p>
      ) : (
        categorie.map((categoria) => (
          <div key={categoria} className="mt-8">
            <h2 className="text-xl font-semibold">{categoria}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {squadre
                .filter((s) => s.categoria === categoria)
                .map((s) => (
                  <li key={s.nome} className="rounded border bg-white p-4">
                    <p className="font-medium">{s.nome}</p>
                    {s.annata && <p className="text-sm text-neutral-600">annata {s.annata}</p>}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
```

Adegua le classi alla gerarchia visiva del sito vecchio (`squadre/page.tsx`
vecchio come riferimento per titoli e card), tenendo la struttura sopra.

- [ ] **Step 2: Contatti e dove siamo**

Porta `contatti/page.tsx` e `dove-siamo/page.tsx` dal sito vecchio: recapiti,
orari, indirizzo, mappa (se il vecchio incorpora un iframe di mappa, si porta
uguale), stessa impostazione. Cade il client-side; `export const metadata`
per ciascuna. Budget ~150 righe l'una, componenti estratti se serve.

- [ ] **Step 3: Verifica**

```bash
npm run lint && npm run type-check && npm run build
```
Expected: puliti; `/squadre` nel riepilogo build compare con revalidate (ISR),
`/contatti` e `/dove-siamo` statiche. Controllo visivo veloce col dev server
(squadre del seed visibili da anonimo), poi chiudilo.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)"
git commit -m "feat(pubblico): squadre dal database, contatti e dove siamo"
```

---

## Task 4: E2E e documentazione

**Files:**
- Create: `e2e/sito-pubblico.spec.ts`
- Modify: `CLAUDE.md` (tabella «Stato»: fase 5 fatta)
- Modify: `docs/ARCHITETTURA.md` (la view pubblica nella sezione Autorizzazione)

- [ ] **Step 1: Scrivere l'E2E**

Crea `e2e/sito-pubblico.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

// Nessuna sessione: il sito pubblico si visita da anonimi. Gli status si
// asseriscono su response.status(), non sul contenuto: con lo streaming un
// 200 può contenere una pagina d'errore (docs/TRAPPOLE.md §7).

test('la home risponde e mostra le sezioni', async ({ page }) => {
  const risposta = await page.goto('/')
  expect(risposta?.status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible()
  await expect(page.locator('#chi-siamo')).toBeVisible()
})

test('le squadre della stagione corrente si leggono da anonimi', async ({ page }) => {
  const risposta = await page.goto('/squadre')
  expect(risposta?.status()).toBe(200)
  await expect(page.getByText('Pulcini A')).toBeVisible()
  await expect(page.getByText('Pulcini B')).toBeVisible()
})

test('contatti e dove siamo rispondono', async ({ page }) => {
  for (const percorso of ['/contatti', '/dove-siamo']) {
    const risposta = await page.goto(percorso)
    expect(risposta?.status()).toBe(200)
  }
})

test('Accedi porta al login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('il backoffice resta protetto', async ({ page }) => {
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login/)
})
```

Se la home non ha un elemento `#chi-siamo` o il link non si chiama `Accedi`,
adegua i selettori a ciò che le pagine vere espongono — mai il contrario.

- [ ] **Step 2: La pipeline completa, nell'ordine**

```bash
npm run db:reset && npm run test:db && npm run test:unit
npm run seed:dev && npm run test:e2e
npm run lint && npm run type-check && npm run build
```
Expected: tutto verde. Il conteggio e2e sale di 5.

- [ ] **Step 3: Documentazione**

In `CLAUDE.md`, tabella «Stato»: riga fase 5 → `| 5 | sito pubblico | fatta, piano \`sito-pubblico\` |`,
e la frase sotto la tabella si adegua (resta da fare solo il cutover).
In `docs/ARCHITETTURA.md`, sezione Autorizzazione, dopo il paragrafo su
`elenco_utenti()`: un paragrafo su `v_squadre_pubbliche` — unica view non
`security_invoker`, perché esiste, dove sta il recinto, e che la matrice RLS
la copre.

- [ ] **Step 4: Commit**

```bash
git add e2e/sito-pubblico.spec.ts CLAUDE.md docs/ARCHITETTURA.md
git commit -m "test: il sito pubblico da anonimi, e documentazione"
```

---

## Ordine e dipendenze

```
1 view + privilegi     ← indipendente
2 client, layout, home ← indipendente (il client consuma tipi del Task 1: eseguire dopo)
3 squadre + statiche   ← richiede 1, 2
4 E2E e docs           ← richiede 2, 3
```

Sequenziali: un implementer alla volta sull'albero.
