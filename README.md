# Virpol Campogalliano — v2

Gestionale per la società sportiva Virpol Campogalliano: anagrafica, tesseramenti,
squadre, presenze e quote, organizzati per stagione sportiva. Next.js (App Router)
con Supabase (Postgres + Auth) come backend; le regole di accesso vivono nelle
RLS del database, non nell'applicazione.

## Prerequisiti

- Node.js 22 o superiore (vedi `.nvmrc`)
- npm — nessun altro package manager è supportato in questo repository
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
  e Docker in esecuzione, per l'istanza Postgres locale

## Setup

```bash
npm install
cp .env.example .env.local
```

Compila `.env.local` con le chiavi del progetto Supabase locale (`supabase start`
le stampa a schermo). `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` servono
solo agli script in `scripts/` e ai test sul database: l'applicazione non li usa.

```bash
supabase start   # avvia Postgres, Auth e l'API locali
npm run dev       # http://localhost:3000
```

## Comandi

```bash
npm run dev          # server di sviluppo
npm run build         # build di produzione — da eseguire sempre prima di un push
npm run start         # serve la build di produzione
npm run lint           # ESLint
npm run type-check      # tsc --noEmit
npm run test:unit       # test unitari (vitest)
npm run test:db         # test sulle RLS e sui repository (vitest + Postgres locale)
npm run test:e2e        # test end-to-end (Playwright, builda e avvia l'app)
npm run db:reset        # riapplica le migration da zero (supabase db reset)
npm run db:types        # rigenera lib/db/types.ts dallo schema locale
npm run seed:dev        # popola stagioni e utenti di sviluppo (vedi sotto)
```

### Ordine dei comandi: non intercambiabile

```
db:reset → test:db → test:unit → seed:dev → test:e2e
```

`test:db` deve girare **prima** di `seed:dev`: alcuni test sui repository
(`repo-stagioni*.test.ts`) cancellano tutte le stagioni in `beforeEach` per
partire da uno stato pulito, e questo cancellerebbe anche i dati seminati se
eseguiti dopo. `test:e2e` invece richiede `seed:dev` già eseguito: builda e
avvia l'app (vedi `playwright.config.ts`) e i test di login si aspettano gli
utenti seminati.

## Utenti di sviluppo

`npm run seed:dev` crea, se non esistono già, una stagione aperta (2026-27),
una chiusa (2025-26) e tre utenti, tutti con password `virpol-dev-123`:

| Email                     | Ruolo       |
| ------------------------- | ----------- |
| `admin@virpol.test`       | admin       |
| `dirigente@virpol.test`   | dirigente   |
| `mister@virpol.test`      | allenatore  |

Non esiste registrazione self-service: gli account si creano solo così, o a
mano con la service role.
