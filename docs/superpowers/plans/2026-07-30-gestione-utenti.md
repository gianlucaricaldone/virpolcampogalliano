# Gestione utenti dal backoffice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dare all'admin una schermata `/admin/utenti` da cui creare gli account applicativi, assegnare i ruoli e disattivare chi se ne va, senza aprire lo Studio di Supabase.

**Architecture:** le due metà restano separate. La **lettura** dell'elenco passa da `public.elenco_utenti()`, una funzione `SECURITY DEFINER` che controlla il ruolo e solleva `42501`, così nessuna pagina scavalca le RLS per mostrare dati. La **scrittura** su `auth.users` passa dalla service role, confinata in un unico file (`app/(app)/admin/utenti/actions.ts`) da una regola ESLint estesa, non allentata.

**Tech Stack:** invariato — Next.js 15, React 19, TypeScript, Supabase (Postgres 17+), zod, Vitest 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-30-gestione-utenti-design.md`

## Global Constraints

Valgono tutte quelle di `CLAUDE.md`. Quelle che questo piano mette sotto pressione:

- **La chiave service role non entra in `lib/repos/`, `components/`, né in nessun file di `app/` diverso da `app/(app)/admin/utenti/actions.ts`.** La regola ESLint è il meccanismo, le fixture sotto test sono la prova.
- **Nessun componente client sotto `app/(app)/admin/utenti/`.** L'eccezione ESLint è su quel singolo file: un `'use client'` nella stessa cartella che importasse il client di servizio spedirebbe la chiave nel bundle del browser. I componenti stanno in `components/utenti/`, dove il divieto vale.
- **Le regole di business restano nello SQL.** Qui l'unica regola nuova — «chi può elencare gli utenti» — sta dentro la funzione, non in TypeScript.
- **Nessuna pagina sopra le ~150 righe.**
- Nomi di dominio e testi utente in italiano; parole chiave tecniche in inglese.
- Commit: prefisso convenzionale inglese, corpo italiano che spiega **perché**.
- Ordine dei test, non interscambiabile: `npm run db:reset && npm run test:db && npm run test:unit`, poi `npm run seed:dev && npm run test:e2e`.

## File Structure

| File | Responsabilità |
|---|---|
| `supabase/migrations/20260730000100_utenti.sql` | la funzione `elenco_utenti()` e i suoi privilegi |
| `lib/domain/password.ts` | `passwordIniziale`, funzione pura |
| `lib/supabase/servizio.ts` | client service role per l'applicazione, con env proprio |
| `lib/repos/utenti.ts` | `elencaUtenti`, `creaProfilo`, `aggiornaProfilo` |
| `lib/validation/utente.ts` | schema zod del form |
| `app/(app)/admin/utenti/actions.ts` | le tre Server Action — **unico file autorizzato alla service role** |
| `app/(app)/admin/utenti/page.tsx` | orchestrazione |
| `components/utenti/TabellaUtenti.tsx` | elenco e azioni per riga (client) |
| `components/utenti/FormNuovoUtente.tsx` | creazione e password mostrata una volta (client) |
| `eslint.config.mjs` | pattern nuovo + eccezione mirata |

---

## Task 1: La funzione `elenco_utenti()` e i suoi privilegi

`auth.users` non è leggibile da `authenticated` e l'email sta lì. Una funzione `SECURITY DEFINER` la espone al solo admin, senza tirare in ballo la service role.

**Files:**
- Create: `supabase/migrations/20260730000100_utenti.sql`
- Create: `tests/db/utenti.test.ts`

**Interfaces:**
- Produces: `public.elenco_utenti()` → `table (id uuid, email text, ruolo public.ruolo_app, attivo boolean, persona_id uuid, persona_cognome text, persona_nome text, created_at timestamptz)`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/db/utenti.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { asAnon, asUser, creaPersona, creaUtenteAuth, inRollback } from './harness'

describe('elenco_utenti', () => {
  it('l\'admin vede gli utenti con la loro email', () =>
    inRollback(async (c) => {
      const admin = await creaUtenteAuth(c, { ruolo: 'admin' })
      const persona = await creaPersona(c, { nome: 'Mister', cognome: 'Prova' })
      await creaUtenteAuth(c, { ruolo: 'allenatore', personaId: persona })

      const { rows } = await asUser(c, admin, () =>
        c.query('select * from public.elenco_utenti()'),
      )
      expect(rows.length).toBeGreaterThanOrEqual(2)
      const mister = rows.find((r) => r.persona_id === persona)
      expect(mister).toMatchObject({ ruolo: 'allenatore', attivo: true, persona_nome: 'Mister' })
      expect(mister.email).toMatch(/@test\.local$/)
    }))

  it('nega a un dirigente e a un allenatore', () =>
    inRollback(async (c) => {
      const dirigente = await creaUtenteAuth(c, { ruolo: 'dirigente' })
      await expect(
        asUser(c, dirigente, () => c.query('select * from public.elenco_utenti()')),
      ).rejects.toThrow(/amministratore/i)
    }))

  it('nega ad anon, che non ha nemmeno il privilegio di eseguirla', () =>
    inRollback(async (c) => {
      // Postgres concede EXECUTE a PUBLIC su ogni funzione nuova: senza la
      // revoca esplicita nella migration, la chiave anon — che viaggia nel
      // bundle del browser — potrebbe leggere auth.users attraverso una
      // funzione SECURITY DEFINER. Questo test è ciò che tiene la revoca.
      await expect(
        asAnon(c, () => c.query('select * from public.elenco_utenti()')),
      ).rejects.toThrow(/permission denied/i)
    }))

  it('nega a un utente senza sessione, invece di restituire tutto', () =>
    inRollback(async (c) => {
      // app.mio_ruolo() torna NULL senza auth.uid(). Con `<> 'admin'` il
      // confronto darebbe NULL, l'IF non scatterebbe e la funzione
      // restituirebbe l'elenco intero: il fallimento silenzioso peggiore
      // possibile. Serve `is distinct from`.
      await c.query('set local role authenticated')
      await expect(c.query('select * from public.elenco_utenti()')).rejects.toThrow(
        /amministratore/i,
      )
      await c.query('set local role postgres')
    }))
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:db -- utenti`
Expected: FAIL, `function public.elenco_utenti() does not exist`.

- [ ] **Step 3: Scrivere la migration**

Crea `supabase/migrations/20260730000100_utenti.sql`:

```sql
-- Elenco degli utenti applicativi con la loro email.
--
-- SECURITY DEFINER perché auth.users non è leggibile da authenticated e
-- l'email sta lì. L'alternativa — leggere l'elenco con la service role da una
-- Server Action — sarebbe una pagina che scavalca le RLS per mostrare dati,
-- cioè il contrario di come è costruito tutto il resto.
--
-- In `public` e non in `app`: lo schema app non è esposto nell'API, quindi una
-- funzione lì non sarebbe chiamabile da .rpc().
create or replace function public.elenco_utenti()
returns table (
  id uuid,
  email text,
  ruolo public.ruolo_app,
  attivo boolean,
  persona_id uuid,
  persona_cognome text,
  persona_nome text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- `is distinct from` e non `<>`: senza sessione app.mio_ruolo() è NULL, il
  -- confronto darebbe NULL, l'IF non scatterebbe e la funzione restituirebbe
  -- l'elenco intero a chiunque. Solleva invece di restituire zero righe: un
  -- elenco vuoto non si distingue da "non ci sono utenti", e un controllo che
  -- fallisce in silenzio è un controllo che prima o poi qualcuno toglie.
  if app.mio_ruolo() is distinct from 'admin' then
    raise exception 'solo un amministratore può elencare gli utenti'
      using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.ruolo, p.attivo, p.persona_id,
           pe.cognome, pe.nome, p.created_at
    from public.profili p
    join auth.users u on u.id = p.id
    left join public.persone pe on pe.id = p.persona_id
    order by u.email;
end
$$;

comment on function public.elenco_utenti() is
  'Solo admin: solleva 42501 per chiunque altro. security definer con '
  'search_path vuoto e nomi qualificati, come le funzioni dello schema app.';

-- Postgres concede EXECUTE a PUBLIC su ogni funzione nuova. Senza questa
-- revoca la chiave anon, che viaggia nel bundle del browser, potrebbe
-- chiamare una funzione security definer che legge auth.users.
revoke execute on function public.elenco_utenti() from public;
grant execute on function public.elenco_utenti() to authenticated;
```

- [ ] **Step 4: Applicare, rigenerare i tipi, verificare il verde**

```bash
npm run db:reset && npm run db:types && npm run test:db -- utenti
```
Expected: 4 test verdi. `lib/db/types.ts` guadagna la firma di `elenco_utenti` sotto `Functions`.

- [ ] **Step 5: Verificare che la matrice dei privilegi non sia cambiata**

Run: `npm run test:db -- rls`
Expected: verde. La funzione non aggiunge privilegi di tabella, quindi
`rls.test.ts` non va toccato. **Se diventa rosso, la migration ha concesso
qualcosa che non doveva: leggere il diff, non aggiornare l'atteso.**

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260730000100_utenti.sql tests/db/utenti.test.ts lib/db/types.ts
git commit -m "feat(db): elenco_utenti, leggibile dal solo admin"
```

---

## Task 2: `passwordIniziale`, funzione pura

**Files:**
- Create: `lib/domain/password.ts`
- Create: `tests/unit/password.test.ts`

**Interfaces:**
- Produces: `passwordIniziale(nome: string): string`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/unit/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { passwordIniziale } from '@/lib/domain/password'

describe('passwordIniziale', () => {
  it('usa il nome in minuscolo col suffisso della società', () => {
    expect(passwordIniziale('Marco')).toBe('marco_VIRPOL_1234')
  })

  it('toglie gli accenti invece di lasciarli passare', () => {
    // Una password con una lettera accentata si detta a voce male e si digita
    // peggio da una tastiera che non ce l'ha.
    expect(passwordIniziale('Niccolò')).toBe('niccolo_VIRPOL_1234')
    expect(passwordIniziale('Renée')).toBe('renee_VIRPOL_1234')
  })

  it('toglie spazi e apostrofi dai nomi composti', () => {
    expect(passwordIniziale('Maria Grazia')).toBe('mariagrazia_VIRPOL_1234')
    expect(passwordIniziale("D'Angelo")).toBe('dangelo_VIRPOL_1234')
  })

  it('non produce una password che comincia col suffisso quando il nome sparisce', () => {
    // '...' non lascia nessun carattere utile: senza il ripiego uscirebbe
    // '_VIRPOL_1234', cioè la stessa password per ogni nome impronunciabile.
    expect(passwordIniziale('...')).toBe('utente_VIRPOL_1234')
    expect(passwordIniziale('')).toBe('utente_VIRPOL_1234')
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- password`
Expected: FAIL, modulo inesistente.

- [ ] **Step 3: Implementare**

Crea `lib/domain/password.ts`:

```ts
const SUFFISSO = '_VIRPOL_1234'

/**
 * Password iniziale di un utente nuovo, dallo schema deciso dalla società:
 * nome di battesimo più suffisso fisso.
 *
 * È indovinabile — chi conosce il nome di un allenatore e la convenzione entra
 * al suo posto — ed è una scelta consapevole del committente, documentata in
 * docs/superpowers/specs/2026-07-30-gestione-utenti-design.md. Se un giorno
 * l'applicazione uscirà dalla singola società, si sostituisce questa funzione
 * con un generatore casuale e non cambia altro.
 */
export function passwordIniziale(nome: string): string {
  const base = nome
    .normalize('NFD')                  // separa le lettere dai segni diacritici
    .replace(/[̀-ͯ]/g, '')   // e li toglie
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return `${base || 'utente'}${SUFFISSO}`
}
```

- [ ] **Step 4: Verificare il verde**

Run: `npm run test:unit -- password`
Expected: 4 test verdi.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/password.ts tests/unit/password.test.ts
git commit -m "feat: password iniziale dallo schema della società"
```

---

## Task 3: Client di servizio e recinto ESLint

**Files:**
- Create: `lib/supabase/servizio.ts`
- Create: `tests/lint/fixtures/app/importa-servizio.tsx`
- Create: `tests/lint/fixtures/lib/repos/importa-servizio.ts`
- Modify: `eslint.config.mjs`
- Modify: `tests/lint/regola-admin.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `supabaseServizio(): SupabaseClient<Database>`

- [ ] **Step 1: Scrivere le fixture e i test della regola**

Crea `tests/lint/fixtures/app/importa-servizio.tsx`:

```tsx
// Sorgente di prova: deve violare la regola no-restricted-imports.
// Non fa parte dell'applicazione e non viene compilato da Next.
import { supabaseServizio } from '@/lib/supabase/servizio'

export function Cattivo() {
  return <span>{String(supabaseServizio)}</span>
}
```

Crea `tests/lint/fixtures/lib/repos/importa-servizio.ts`:

```ts
// Sorgente di prova: un repository non deve poter costruire un client che
// ignora le RLS, nemmeno passando dal modulo nuovo.
import { supabaseServizio } from '../../../../lib/supabase/servizio'

export const cattivo = () => supabaseServizio()
```

In `tests/lint/regola-admin.test.ts`, dentro il `describe` esistente:

```ts
  it('rifiuta un import di lib/supabase/servizio sotto app/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/app/importa-servizio.tsx')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)

  it('rifiuta un import relativo di supabase/servizio dentro lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/importa-servizio.ts')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:unit -- regola-admin`
Expected: i due test nuovi falliscono — ESLint esce 0, perché il pattern non
esiste ancora.

- [ ] **Step 3: Estendere la regola**

In `eslint.config.mjs`, accanto agli altri messaggi:

```js
const messaggioServizio =
  'lib/supabase/servizio usa la chiave service role e ignora ogni RLS: ' +
  'può essere importato solo da app/(app)/admin/utenti/actions.ts, che crea ' +
  'gli utenti applicativi.'
```

Nel blocco `no-restricted-imports` esistente, come terzo pattern:

```js
        }, {
          regex: '(^|/)supabase/servizio$',
          message: messaggioServizio,
        }],
```

Subito **dopo** quel blocco, l'eccezione:

```js
  {
    // Unica eccezione al divieto, e la più stretta possibile: un file solo,
    // non una cartella. Un 'use client' dentro app/(app)/admin/utenti/ che
    // importasse il client di servizio spedirebbe la chiave nel bundle del
    // browser; con l'eccezione su questo singolo percorso non può accadere.
    // Il lato permesso non ha una fixture: lo dimostra il file vero, perché
    // se l'eccezione smettesse di funzionare `npm run lint` fallirebbe su di
    // lui. Vedi docs/superpowers/specs/2026-07-30-gestione-utenti-design.md.
    files: ['app/(app)/admin/utenti/actions.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { regex: '(^|/)supabase/admin$', message: messaggioAdmin },
          { regex: '(^|/)scripts/env$', message: messaggioEnvScript },
        ],
      }],
    },
  },
```

- [ ] **Step 4: Scrivere il client di servizio**

Crea `lib/supabase/servizio.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/lib/db/types'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

/**
 * Client con chiave service role per l'applicazione. Ignora ogni RLS.
 *
 * Distinto da lib/supabase/admin, che resta agli script e legge l'ambiente da
 * scripts/env: quel modulo non deve diventare importabile da app/ nemmeno per
 * sbaglio. Qui l'ambiente si valida in proprio.
 *
 * Serve a una cosa sola: creare e aggiornare utenti in auth.users, che non è
 * raggiungibile con la chiave anon. Tutto il resto — anche l'inserimento in
 * profili subito dopo — passa dal client normale, sotto RLS: se una policy
 * regredisse, un test se ne accorgerebbe.
 */
export function supabaseServizio() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    // Messaggio esplicito: un deploy senza la variabile deve rompersi al primo
    // uso con una frase leggibile, non restituire 401 opachi da Auth.
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY assente o non valida: la gestione degli utenti non può funzionare.',
    )
  }
  return createClient<Database>(
    esito.data.NEXT_PUBLIC_SUPABASE_URL,
    esito.data.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

In `.env.example`, sotto le variabili esistenti:

```
# Serve solo alla schermata di gestione utenti: crea gli account in auth.users,
# cosa che la chiave anon non può fare. Un solo file dell'applicazione può
# leggerla, e una regola ESLint lo verifica.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Verificare il verde**

```bash
npm run test:unit -- regola-admin && npm run lint && npm run type-check
```
Expected: tutti i test della regola verdi, lint pulito.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/servizio.ts eslint.config.mjs tests/lint .env.example
git commit -m "feat: client di servizio per l'app, recintato a un solo file"
```

---

## Task 4: Repository degli utenti

**Files:**
- Create: `lib/repos/utenti.ts`
- Create: `tests/db/repo-utenti.test.ts`

**Interfaces:**
- Consumes: `public.elenco_utenti()` (Task 1)
- Produces:
  - `type Utente = { id: string; email: string; ruolo: RuoloApp; attivo: boolean; persona: { id: string; cognome: string; nome: string } | null }`
  - `elencaUtenti(db: Db): Promise<Utente[]>`
  - `creaProfilo(db: Db, dati: { id: string; ruolo: RuoloApp; personaId: string | null }): Promise<void>`
  - `aggiornaProfilo(db: Db, id: string, dati: { ruolo?: RuoloApp; personaId?: string | null; attivo?: boolean }): Promise<void>`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `tests/db/repo-utenti.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { aggiornaProfilo, elencaUtenti } from '@/lib/repos/utenti'
import { clientPerRuolo, creaPersona } from './harness-repo'

describe('elencaUtenti', () => {
  it('l\'admin vede gli altri utenti con email e persona', async () => {
    const admin = await clientPerRuolo('admin')
    const mister = await clientPerRuolo('allenatore')

    const utenti = await elencaUtenti(admin.db)
    const riga = utenti.find((u) => u.id === mister.userId)
    expect(riga).toMatchObject({ ruolo: 'allenatore', attivo: true })
    expect(riga?.persona?.id).toBe(mister.personaId)
    expect(riga?.email).toContain('@test.local')
  })

  it('a un dirigente la funzione nega, non restituisce un elenco vuoto', async () => {
    const { db } = await clientPerRuolo('dirigente')
    await expect(elencaUtenti(db)).rejects.toMatchObject({ code: '42501' })
  })
})

describe('aggiornaProfilo', () => {
  it('l\'admin cambia ruolo e collega la persona in una sola scrittura', async () => {
    // Promuovere qualcuno ad allenatore è un gesto solo: in due chiamate la
    // prima passerebbe e la seconda verrebbe respinta da
    // profili_allenatore_ha_persona, lasciando un profilo incoerente.
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    const personaId = await creaPersona({ cognome: 'Promosso' })

    await aggiornaProfilo(admin.db, utente.userId, { ruolo: 'allenatore', personaId })
    const riga = (await elencaUtenti(admin.db)).find((u) => u.id === utente.userId)
    expect(riga).toMatchObject({ ruolo: 'allenatore' })
    expect(riga?.persona?.id).toBe(personaId)
  })

  it('rifiuta di promuovere ad allenatore senza persona', async () => {
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    await expect(
      aggiornaProfilo(admin.db, utente.userId, { ruolo: 'allenatore' }),
    ).rejects.toMatchObject({
      code: '23514',
      message: expect.stringContaining('profili_allenatore_ha_persona'),
    })
  })

  it('disattiva un utente', async () => {
    const admin = await clientPerRuolo('admin')
    const utente = await clientPerRuolo('dirigente')
    await aggiornaProfilo(admin.db, utente.userId, { attivo: false })
    expect((await elencaUtenti(admin.db)).find((u) => u.id === utente.userId)?.attivo).toBe(false)
  })

  it('a un dirigente le policy non fanno cambiare nulla', async () => {
    // profili_upd è riservata all'admin. Una update negata dalle RLS filtra le
    // righe: riesce e tocca zero righe, quindi si guarda il dato.
    const admin = await clientPerRuolo('admin')
    const attaccante = await clientPerRuolo('dirigente')
    const vittima = await clientPerRuolo('allenatore')

    await aggiornaProfilo(attaccante.db, vittima.userId, { ruolo: 'admin' })
    expect((await elencaUtenti(admin.db)).find((u) => u.id === vittima.userId)?.ruolo)
      .toBe('allenatore')
  })
})
```

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:db -- repo-utenti`
Expected: FAIL, `lib/repos/utenti` non esiste.

- [ ] **Step 3: Implementare il repository**

Crea `lib/repos/utenti.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RuoloApp } from '@/lib/auth/session'
import type { Database } from '@/lib/db/types'

type Db = SupabaseClient<Database>

export type Utente = {
  id: string
  email: string
  ruolo: RuoloApp
  attivo: boolean
  persona: { id: string; cognome: string; nome: string } | null
}

/**
 * L'elenco passa da una funzione SECURITY DEFINER e non da una select: l'email
 * vive in auth.users, che `authenticated` non può leggere. La funzione nega a
 * chi non è admin sollevando 42501, quindi qui non serve nessun controllo.
 */
export async function elencaUtenti(db: Db): Promise<Utente[]> {
  const { data, error } = await db.rpc('elenco_utenti')
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    ruolo: r.ruolo,
    attivo: r.attivo,
    persona:
      r.persona_id && r.persona_cognome && r.persona_nome
        ? { id: r.persona_id, cognome: r.persona_cognome, nome: r.persona_nome }
        : null,
  }))
}

export async function creaProfilo(
  db: Db,
  dati: { id: string; ruolo: RuoloApp; personaId: string | null },
): Promise<void> {
  const { error } = await db
    .from('profili')
    .insert({ id: dati.id, ruolo: dati.ruolo, persona_id: dati.personaId })
  if (error) throw error
}

/**
 * Ruolo, persona e stato in **una** UPDATE. Promuovere qualcuno ad allenatore
 * significa cambiare ruolo e collegare la persona nello stesso gesto: in due
 * scritture la prima passerebbe e la seconda verrebbe respinta da
 * profili_allenatore_ha_persona, lasciando un profilo che non sta in piedi.
 */
export async function aggiornaProfilo(
  db: Db,
  id: string,
  dati: { ruolo?: RuoloApp; personaId?: string | null; attivo?: boolean },
): Promise<void> {
  const riga: Database['public']['Tables']['profili']['Update'] = {}
  if (dati.ruolo !== undefined) riga.ruolo = dati.ruolo
  if (dati.personaId !== undefined) riga.persona_id = dati.personaId
  if (dati.attivo !== undefined) riga.attivo = dati.attivo

  const { error } = await db.from('profili').update(riga).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Verificare il verde**

```bash
npm run test:db -- repo-utenti && npm run type-check
```
Expected: 6 test verdi.

- [ ] **Step 5: Commit**

```bash
git add lib/repos/utenti.ts tests/db/repo-utenti.test.ts
git commit -m "feat: repository degli utenti applicativi"
```

---

## Task 5: Azioni, schermata e navigazione

**Files:**
- Create: `lib/validation/utente.ts`
- Create: `app/(app)/admin/utenti/actions.ts`
- Create: `app/(app)/admin/utenti/page.tsx`
- Create: `components/utenti/TabellaUtenti.tsx`
- Create: `components/utenti/FormNuovoUtente.tsx`
- Modify: `components/layout/NavBackoffice.tsx`

**Interfaces:**
- Consumes: `passwordIniziale` (Task 2), `supabaseServizio` (Task 3), `elencaUtenti` / `creaProfilo` / `aggiornaProfilo` (Task 4)
- Produces:
  - `creaUtenteAzione(_precedente, form: FormData): Promise<Risultato<{ email: string; password: string }>>`
  - `aggiornaUtenteAzione(id: string, dati: { ruolo?: RuoloApp; attivo?: boolean }): Promise<Risultato<null>>`
  - `reimpostaPasswordAzione(id: string): Promise<Risultato<{ password: string }>>`

- [ ] **Step 1: Scrivere lo schema di validazione**

Crea `lib/validation/utente.ts`:

```ts
import { z } from 'zod'
import { facoltativo } from '@/lib/validation/comune'

/**
 * Il vincolo profili_allenatore_ha_persona rifiuterebbe comunque un allenatore
 * senza persona, ma con un messaggio che parla di un vincolo del database.
 * Qui si dice all'utente cosa manca.
 */
export const schemaNuovoUtente = z
  .object({
    email: z.email('Indirizzo email non valido'),
    ruolo: z.enum(['admin', 'dirigente', 'allenatore'], { message: 'Scegli un ruolo' }),
    personaId: facoltativo(z.uuid('Persona non valida')),
  })
  .refine((d) => d.ruolo !== 'allenatore' || d.personaId !== null, {
    message: 'Un allenatore va collegato a una persona in anagrafica',
    path: ['personaId'],
  })

export function campiNuovoUtente(form: FormData): Record<string, unknown> {
  return {
    email: form.get('email'),
    ruolo: form.get('ruolo'),
    personaId: form.get('personaId'),
  }
}
```

- [ ] **Step 2: Scrivere le Server Action**

Crea `app/(app)/admin/utenti/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { daErroreZod, ErroreDominio, eseguiAzione, type Risultato } from '@/lib/azioni'
import { richiediRuolo, type RuoloApp } from '@/lib/auth/session'
import { passwordIniziale } from '@/lib/domain/password'
import { personaPerId } from '@/lib/repos/persone'
import { aggiornaProfilo, creaProfilo, elencaUtenti } from '@/lib/repos/utenti'
import { supabaseServizio } from '@/lib/supabase/servizio'
import { supabaseServer } from '@/lib/supabase/server'
import { campiNuovoUtente, schemaNuovoUtente } from '@/lib/validation/utente'

function eEmailGiaUsata(messaggio: string): boolean {
  // Auth non espone un codice per questo caso: resta il messaggio.
  return /already been registered|already exists|duplicate/i.test(messaggio)
}

export async function creaUtenteAzione(
  _precedente: Risultato<{ email: string; password: string }> | null,
  form: FormData,
): Promise<Risultato<{ email: string; password: string }>> {
  const campi = schemaNuovoUtente.safeParse(campiNuovoUtente(form))
  if (!campi.success) return daErroreZod(campi.error)

  const esito = await eseguiAzione('utenti.crea', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])

    const persona = campi.data.personaId ? await personaPerId(db, campi.data.personaId) : null
    if (campi.data.personaId && !persona) {
      throw new ErroreDominio('La persona scelta non esiste più: ricarica la pagina')
    }
    const password = passwordIniziale(persona?.nome ?? campi.data.email.split('@')[0])

    const servizio = supabaseServizio()
    const { data: creato, error } = await servizio.auth.admin.createUser({
      email: campi.data.email,
      password,
      // Senza SMTP nessuno riceverà mai una mail di conferma, e senza questo
      // flag l'utente non potrebbe accedere.
      email_confirm: true,
    })
    if (error) {
      if (eEmailGiaUsata(error.message)) {
        throw new ErroreDominio('Esiste già un utente con questa email')
      }
      throw error
    }

    try {
      await creaProfilo(db, {
        id: creato.user.id,
        ruolo: campi.data.ruolo,
        personaId: campi.data.personaId,
      })
    } catch (e) {
      // Compensazione. Un profilo rifiutato lascerebbe in auth.users un utente
      // che non può entrare ma tiene occupata l'email: il secondo tentativo
      // fallirebbe con "email già registrata" e nessuno capirebbe perché.
      await servizio.auth.admin.deleteUser(creato.user.id)
      throw e
    }

    return { email: campi.data.email, password }
  })

  if (esito.ok) revalidatePath('/admin/utenti')
  return esito
}

export async function aggiornaUtenteAzione(
  id: string,
  dati: { ruolo?: RuoloApp; attivo?: boolean },
): Promise<Risultato<null>> {
  const esito = await eseguiAzione('utenti.aggiorna', async () => {
    const db = await supabaseServer()
    const sessione = await richiediRuolo(db, ['admin'])

    // profili_upd guarda il ruolo di chi scrive, non chi subisce: le policy
    // lascerebbero passare. In una società con un solo amministratore questo
    // click chiuderebbe fuori tutti, senza più nessuno in grado di riaprire.
    if (id === sessione.userId && (dati.attivo === false || (dati.ruolo && dati.ruolo !== 'admin'))) {
      throw new ErroreDominio('Non puoi disattivare o declassare il tuo stesso account')
    }

    await aggiornaProfilo(db, id, dati)
    return null
  })

  if (esito.ok) revalidatePath('/admin/utenti')
  return esito
}

export async function reimpostaPasswordAzione(id: string): Promise<Risultato<{ password: string }>> {
  return eseguiAzione('utenti.password', async () => {
    const db = await supabaseServer()
    await richiediRuolo(db, ['admin'])

    // Si rilegge dall'elenco invece di aggiungere una funzione SQL per un solo
    // utente: sono una manciata di righe, e la funzione esiste già.
    const utente = (await elencaUtenti(db)).find((u) => u.id === id)
    if (!utente) throw new ErroreDominio('Utente non trovato')

    const password = passwordIniziale(utente.persona?.nome ?? utente.email.split('@')[0])
    const { error } = await supabaseServizio().auth.admin.updateUserById(id, { password })
    if (error) throw error
    return { password }
  })
}
```

- [ ] **Step 3: Scrivere i due componenti**

Crea `components/utenti/FormNuovoUtente.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { Persona } from '@/lib/repos/persone'

type Azione = (
  precedente: Risultato<{ email: string; password: string }> | null,
  form: FormData,
) => Promise<Risultato<{ email: string; password: string }>>

const RUOLI = [
  { valore: 'allenatore', etichetta: 'Allenatore' },
  { valore: 'dirigente', etichetta: 'Dirigente' },
  { valore: 'admin', etichetta: 'Amministratore' },
]

export function FormNuovoUtente({
  azione,
  candidati,
}: {
  azione: Azione
  candidati: Persona[]
}) {
  const [esito, invia, inCorso] = useActionState(azione, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <div className="space-y-3">
      {esito?.ok && (
        // Mostrata una volta sola: non viene riletta da nessuna parte, e alla
        // prossima navigazione sparisce. Se l'admin la perde, la rigenera dalla
        // riga in tabella.
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <p className="text-sm text-green-900">
            Utente creato. Comunica queste credenziali a voce:
          </p>
          <p className="mt-2 font-mono text-sm">
            {esito.dati.email} · <strong>{esito.dati.password}</strong>
          </p>
        </div>
      )}

      <form action={invia} className="space-y-3 rounded border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required
                   className="mt-1 rounded border px-2 py-1" />
            {campi?.email && <p role="alert" className="mt-1 text-sm text-red-700">{campi.email}</p>}
          </div>
          <div className="flex flex-col">
            <label htmlFor="ruolo" className="text-sm font-medium">Ruolo</label>
            <select id="ruolo" name="ruolo" className="mt-1 rounded border px-2 py-1">
              {RUOLI.map((r) => (
                <option key={r.valore} value={r.valore}>{r.etichetta}</option>
              ))}
            </select>
            {campi?.ruolo && <p role="alert" className="mt-1 text-sm text-red-700">{campi.ruolo}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Persona in anagrafica</legend>
          <p className="text-xs text-neutral-500">
            Obbligatoria per un allenatore: senza, non vedrebbe nessuna squadra.
          </p>
          {campi?.personaId && (
            <p role="alert" className="mt-1 text-sm text-red-700">{campi.personaId}</p>
          )}
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            <label className="flex items-center gap-2 rounded px-2 py-1">
              <input type="radio" name="personaId" value="" defaultChecked />
              <span className="text-sm text-neutral-600">Nessuna</span>
            </label>
            {candidati.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-50">
                <input type="radio" name="personaId" value={p.id} />
                <span className="text-sm">{p.cognome} {p.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={inCorso}
                  className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-60">
            {inCorso ? 'Creazione…' : 'Crea utente'}
          </button>
          {esito && !esito.ok && !campi && (
            <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
          )}
        </div>
      </form>
    </div>
  )
}
```

Crea `components/utenti/TabellaUtenti.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Risultato } from '@/lib/azioni'
import type { RuoloApp } from '@/lib/auth/session'
import type { Utente } from '@/lib/repos/utenti'

const ETICHETTA_RUOLO: Record<string, string> = {
  admin: 'Amministratore',
  dirigente: 'Dirigente',
  allenatore: 'Allenatore',
}

export function TabellaUtenti({
  utenti,
  idCorrente,
  aggiorna,
  reimposta,
}: {
  utenti: Utente[]
  idCorrente: string
  aggiorna: (id: string, dati: { ruolo?: RuoloApp; attivo?: boolean }) => Promise<Risultato<null>>
  reimposta: (id: string) => Promise<Risultato<{ password: string }>>
}) {
  const [errore, setErrore] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  function esegui(azione: () => Promise<Risultato<unknown>>) {
    setErrore(null)
    setPassword(null)
    avvia(async () => {
      const esito = await azione()
      if (!esito.ok) setErrore(esito.errore)
      else if (esito.dati && typeof esito.dati === 'object' && 'password' in esito.dati) {
        setPassword(String(esito.dati.password))
      }
    })
  }

  return (
    <div className="space-y-2">
      {errore && <p role="alert" className="text-sm text-red-700">{errore}</p>}
      {password && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 font-mono text-sm">
          Nuova password: <strong>{password}</strong>
        </p>
      )}

      <table className="w-full border-collapse overflow-hidden rounded border bg-white text-sm">
        <thead className="bg-neutral-100 text-left">
          <tr>
            <th className="p-2">Email</th>
            <th className="p-2">Ruolo</th>
            <th className="p-2">Persona</th>
            <th className="p-2">Stato</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2 font-medium">{u.email}</td>
              <td className="p-2 text-neutral-600">{ETICHETTA_RUOLO[u.ruolo] ?? u.ruolo}</td>
              <td className="p-2 text-neutral-600">
                {u.persona ? `${u.persona.cognome} ${u.persona.nome}` : '—'}
              </td>
              <td className="p-2">
                {u.attivo ? 'attivo' : (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-neutral-700">
                    disattivato
                  </span>
                )}
              </td>
              <td className="p-2 text-right">
                <div className="flex justify-end gap-3">
                  <button type="button" disabled={inCorso}
                          onClick={() => esegui(() => reimposta(u.id))}
                          className="underline disabled:opacity-60">
                    Reimposta password
                  </button>
                  {/* Su sé stessi il pulsante non compare: l'azione rifiuterebbe
                      comunque, ma offrirlo e poi negarlo è una trappola. */}
                  {u.id !== idCorrente && (
                    <button type="button" disabled={inCorso}
                            onClick={() => esegui(() => aggiorna(u.id, { attivo: !u.attivo }))}
                            className="underline disabled:opacity-60">
                      {u.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Scrivere la pagina e la voce di menù**

Crea `app/(app)/admin/utenti/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { FormNuovoUtente } from '@/components/utenti/FormNuovoUtente'
import { TabellaUtenti } from '@/components/utenti/TabellaUtenti'
import { sessioneCorrente } from '@/lib/auth/corrente'
import { elencaPersone } from '@/lib/repos/persone'
import { elencaUtenti } from '@/lib/repos/utenti'
import { supabaseServer } from '@/lib/supabase/server'
import { aggiornaUtenteAzione, creaUtenteAzione, reimpostaPasswordAzione } from './actions'

export default async function PaginaUtenti({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [db, sessione] = await Promise.all([supabaseServer(), sessioneCorrente()])
  if (sessione?.ruolo !== 'admin') redirect('/gestione')

  // Come nel tesseramento: si cerca prima di elencare, altrimenti l'anagrafica
  // intera finisce in una lista di radio button.
  const [utenti, candidati] = await Promise.all([
    elencaUtenti(db),
    q ? elencaPersone(db, { cognome: q, soloAttive: true }) : [],
  ])

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Utenti</h1>
      <p className="text-sm text-neutral-600">
        La password iniziale si legge una volta dopo la creazione e si comunica a voce.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Cerca in anagrafica</label>
          <input id="q" name="q" defaultValue={q ?? ''} placeholder="Cognome"
                 className="mt-1 rounded border px-2 py-1" />
        </div>
        <button type="submit" className="rounded border px-3 py-2 text-sm">Cerca</button>
      </form>

      <FormNuovoUtente azione={creaUtenteAzione} candidati={candidati} />

      <TabellaUtenti
        utenti={utenti}
        idCorrente={sessione.userId}
        aggiorna={aggiornaUtenteAzione}
        reimposta={reimpostaPasswordAzione}
      />
    </section>
  )
}
```

In `components/layout/NavBackoffice.tsx`, accanto alla voce Stagioni:

```tsx
        {ruolo === 'admin' && <Link href="/admin/utenti">Utenti</Link>}
```

- [ ] **Step 5: Verificare a mano il giro completo**

```bash
npm run db:reset && npm run seed:dev && npm run dev
```

Con `admin@virpol.test`: cerca `Prova` in anagrafica, scegli Mister Prova, ruolo
Allenatore, email `mister2@virpol.test`. Deve comparire la password
`mister_VIRPOL_1234`. Poi esci e rientra con quelle credenziali.

- [ ] **Step 6: Verificare lint e tipi**

```bash
npm run lint && npm run type-check
```
Expected: pulito. **Se `lint` segnala l'import di `supabase/servizio` in
`actions.ts`, l'eccezione del Task 3 non sta funzionando: è il caso da
correggere, non da silenziare.**

- [ ] **Step 7: Commit**

```bash
git add lib/validation/utente.ts "app/(app)/admin/utenti" components/utenti components/layout/NavBackoffice.tsx
git commit -m "feat: schermata di gestione degli utenti applicativi"
```

---

## Task 6: E2E del giro completo e documentazione

**Files:**
- Create: `e2e/utenti.spec.ts`
- Modify: `CLAUDE.md`
- Modify: `docs/ARCHITETTURA.md`

- [ ] **Step 1: Scrivere l'E2E**

Crea `e2e/utenti.spec.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const COGNOME = 'Provautente'
const EMAIL_NUOVA = 'provautente@virpol.test'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  const { data } = await db.auth.admin.listUsers({ perPage: 200 })
  const creato = data.users.find((u) => u.email === EMAIL_NUOVA)
  // Cancellare l'utente Auth porta via il profilo per cascade; la persona va
  // dopo, perché profili.persona_id è on delete restrict.
  if (creato) await db.auth.admin.deleteUser(creato.id)
  await db.from('persone').delete().eq('cognome', COGNOME)
}

test.beforeEach(async () => {
  await rimuoviProve()
  const db = clientServizio()
  const { error } = await db.from('persone').insert({
    nome: 'Rocco', cognome: COGNOME, data_nascita: '1985-02-11',
  })
  if (error) throw error
})
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entra' }).click()
}

test('l\'admin crea un mister e quel mister entra davvero', async ({ page, browser }) => {
  await accedi(page, 'admin@virpol.test')
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)

  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill(EMAIL_NUOVA)
  await page.getByLabel('Ruolo').selectOption('allenatore')
  await page.getByRole('radio', { name: new RegExp(`${COGNOME} Rocco`) }).check()
  await page.getByRole('button', { name: 'Crea utente' }).click()

  await expect(page.getByText('rocco_VIRPOL_1234')).toBeVisible()
  await expect(page.getByRole('cell', { name: EMAIL_NUOVA })).toBeVisible()

  // Contesto nuovo: la pagina corrente ha già la sessione dell'admin, e il
  // middleware rimanderebbe indietro chi apre /login con un cookie valido.
  const contesto = await browser.newContext()
  const paginaMister = await contesto.newPage()
  await accedi(paginaMister, EMAIL_NUOVA, 'rocco_VIRPOL_1234')
  await expect(paginaMister).toHaveURL(/\/\d{4}-\d{2}$/)
  // Nessun incarico: vede il messaggio, non un elenco altrui.
  await paginaMister.goto('/2026-27/presenze')
  await expect(paginaMister.getByText(/non hai incarichi/i)).toBeVisible()
  await contesto.close()
})

test('un utente disattivato non entra più', async ({ page, browser }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill(EMAIL_NUOVA)
  await page.getByLabel('Ruolo').selectOption('dirigente')
  await page.getByRole('button', { name: 'Crea utente' }).click()
  await expect(page.getByRole('cell', { name: EMAIL_NUOVA })).toBeVisible()

  await page.getByRole('row').filter({ hasText: EMAIL_NUOVA })
    .getByRole('button', { name: 'Disattiva' }).click()
  await expect(page.getByRole('row').filter({ hasText: EMAIL_NUOVA }))
    .toContainText('disattivato')

  const contesto = await browser.newContext()
  const paginaBloccata = await contesto.newPage()
  await accedi(paginaBloccata, EMAIL_NUOVA, 'provautente_VIRPOL_1234')
  await expect(paginaBloccata).toHaveURL(/\/login/)
  await contesto.close()
})

test('l\'admin non può disattivare sé stesso', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/utenti')
  const propria = page.getByRole('row').filter({ hasText: 'admin@virpol.test' })
  await expect(propria.getByRole('button', { name: 'Disattiva' })).toHaveCount(0)
})

test('un dirigente non entra nella gestione utenti', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await expect(page.getByRole('link', { name: 'Utenti' })).toHaveCount(0)
  await page.goto('/admin/utenti')
  await expect(page).toHaveURL(/\/2026-27$/)
})

test('un\'email già usata lo dice, invece di lasciare un utente a metà', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Ruolo').selectOption('dirigente')
  await page.getByRole('button', { name: 'Crea utente' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /già un utente/i })).toBeVisible()
})
```

- [ ] **Step 2: Eseguire la pipeline completa, nell'ordine**

```bash
npm run db:reset && npm run test:db && npm run test:unit
npm run seed:dev && npm run test:e2e
npm run lint && npm run type-check && npm run build
```
Expected: tutto verde.

- [ ] **Step 3: Aggiornare la documentazione**

In `CLAUDE.md`, sezione «Debito noto»: togliere la voce sulla gestione utenti.
Nella sezione «Invarianti», dopo il paragrafo sulla chiave service role,
aggiungere:

```markdown
L'unica eccezione è `app/(app)/admin/utenti/actions.ts`, che crea gli account
in `auth.users` — cosa che la chiave anon non può fare. È un file solo, non una
cartella, così un `'use client'` vicino non può trascinare la chiave nel
bundle. Su Vercel serve quindi `SUPABASE_SERVICE_ROLE_KEY` fra le variabili
d'ambiente.
```

In `docs/ARCHITETTURA.md`, sezione «Autorizzazione», dopo le funzioni helper:

```markdown
`public.elenco_utenti()` è l'unica funzione `SECURITY DEFINER` esposta
nell'API. Il controllo del ruolo è dentro di lei e usa `is distinct from`:
`app.mio_ruolo()` è NULL senza sessione, e con `<>` il confronto darebbe NULL,
l'IF non scatterebbe e la funzione restituirebbe l'elenco intero. La revoca
dell'EXECUTE che Postgres concede a PUBLIC è ciò che tiene fuori `anon`, e ha
un test suo.
```

- [ ] **Step 4: Commit**

```bash
git add e2e/utenti.spec.ts CLAUDE.md docs/ARCHITETTURA.md
git commit -m "test: il giro completo della creazione utenti, e documentazione"
```

---

## Ordine e dipendenze

```
1 funzione SQL      ← indipendente
2 password          ← indipendente
3 client + ESLint   ← indipendente
4 repository        ← richiede 1
5 azioni e pagina   ← richiede 2, 3, 4
6 E2E e docs        ← richiede 5
```

I task 1, 2 e 3 sono paralleli in teoria; in pratica un implementer alla volta
sull'albero, quindi sequenziali.
