# CLAUDE.md — Gestionale Virpol Campogalliano (riscrittura)

Contesto operativo per sessioni Claude Code su questo repository. Leggilo prima di
toccare qualsiasi cosa.

## Cos'è questo progetto

Gestionale per una società di calcio giovanile: anagrafica giocatori e staff,
squadre, presenze agli allenamenti, quote di iscrizione, visite mediche.
**Organizzazione singola, multi-stagione nativo.**

È la riscrittura da zero di un'applicazione esistente che vive in
`~/Progetti/virpolcampogalliano`. Quel repo **resta in produzione** fino al
cutover e non va modificato: ospita il piano, lo spec e il ledger di esecuzione,
e sarà la fonte dello script di migrazione dati.

Documenti di riferimento, in quell'altro repo:

- `docs/superpowers/specs/2026-07-29-gestionale-sportivo-rewrite-design.md` — il design e il perché di ogni scelta
- `docs/superpowers/plans/2026-07-29-fondamenta-schema-auth.md` — il piano della fase 1, task per task
- `.superpowers/sdd/2026-07-29-fondamenta-schema-auth/progress.md` — il ledger: ogni difetto trovato, ogni decisione, ogni finding differito

Se una decisione qui ti sembra arbitraria, la ragione è in uno di quei tre.

## Stato: fase 1 di 6, completa

Questa fase ha costruito le fondamenta: schema, autorizzazione, autenticazione,
shell del backoffice. Le fasi successive, ognuna con spec e piano propri:

| Fase | Contenuto |
|---|---|
| 2 | anagrafica persone, squadre, tesseramenti, incarichi staff, admin utenti |
| 3 | quote, pagamenti, visita medica, cruscotto scadenze |
| 4 | sedute, foglio presenze, statistiche |
| 5 | sito pubblico |
| 6 | script di migrazione dati e cutover |

**Il primo task della fase 2 non è una feature.** È un harness di test per i
repository — vedi "Debito noto" sotto.

## Stack

Next.js 15 App Router, React 19, TypeScript 5, Tailwind 4, shadcn/ui,
Supabase (**Postgres 17+**, Auth, `@supabase/ssr`), zod, Vitest 4, Playwright.

**Postgres 17 è un minimo, non una preferenza.** La migration delle RLS revoca il
privilegio `MAINTAIN`, che non esiste prima della 17. Su un progetto 15 quella
migration falisce il parsing *dopo* che le cinque precedenti sono passate: ti
resta uno schema in piedi con RLS mai abilitata e zero policy. Un database che
sembra funzionante e non protegge nulla.

## Comandi, e un ordine che non è interscambiabile

```bash
npx supabase start          # richiede Docker attivo
npm run db:reset            # applica le 6 migration da zero
npm run seed:dev            # 3 utenti + stagioni di prova
npm run dev                 # http://localhost:3000
```

Credenziali di sviluppo: `admin@virpol.test`, `dirigente@virpol.test`,
`mister@virpol.test`, password `virpol-dev-123`.

Per i test, **in questo ordine**:

```bash
npm run db:reset && npm run test:db && npm run test:unit
npm run seed:dev && npm run test:e2e
npm run lint && npm run type-check && npm run build
```

`test:db` contiene suite che cancellano tutte le stagioni in `beforeEach`, quindi
distruggono il seed. Mai `seed:dev` prima di `test:db`.

## Invarianti che non si violano

Ognuno esiste perché il sistema che stiamo sostituendo lo violava, e ognuno è
verificato da almeno un test. Se ti trovi a volerne rimuovere uno per far passare
qualcosa, fermati: è il segnale che il problema è altrove.

**Nessun `organization_id` in nessuna tabella.** L'applicazione è a organizzazione
singola. Il sistema vecchio l'aveva ovunque per un multi-tenant mai servito, e
sei migration consecutive erano tentativi di aggiungerlo.

**La stagione corrente è derivata, mai memorizzata.** È la prima con
`stato = 'aperta'` ordinata per `data_inizio DESC`. Niente flag `attiva`, niente
valore in cache, niente riga di configurazione. Il sistema vecchio aveva due
sorgenti in conflitto e nessuno sapeva quale fosse giusta. La regola vive in
`stagioneCorrenteDa` in `lib/domain/stagione.ts`: se ti serve in un punto nuovo,
chiama quella — non riscriverla.

**Nessuna cache di autenticazione.** `getSessione` interroga il server Auth e
rilegge `profili` a ogni chiamata. Il sistema vecchio teneva lo stato in cache per
cinque minuti, quindi un ruolo revocato restava utilizzabile per cinque minuti.
Se ti serve deduplicazione dentro una richiesta usa `React.cache`, che è
request-scoped e non ha TTL — non un `Map` a livello di modulo.

**Le regole di business vivono solo nello SQL.** Stato quota, stato visita medica,
percentuali di presenza: esistono nelle view `v_quote` e `v_presenze` e in nessuna
copia TypeScript. Due implementazioni divergono, e quando divergono l'elenco dice
"parziale" mentre la scheda dice "saldato". `lib/domain/` contiene solo funzioni
pure di formattazione, mai regole.

**Le RLS sono la difesa primaria, i controlli applicativi la seconda.**
`richiediRuolo` in una Server Action dà un messaggio leggibile; la policy regge
anche se un'azione nuova dimentica quella riga. Nessun controllo di ruolo nel
middleware: il sistema vecchio ne aveva uno su un matcher sbagliato che non
scattava mai e nulla lo segnalava.

**La chiave service role sta solo in `scripts/`.** Quel client scavalca ogni
policy. Una regola ESLint vieta di importare `lib/supabase/admin` **e**
`scripts/env` da `app/`, `components/` e `lib/repos/`, con fixture sotto test —
se la regola smette di scattare, un test diventa rosso.

## Architettura

**Si legge nei Server Component, si scrive nelle Server Action.** Il browser non
parla mai direttamente con Supabase per dati di dominio. `supabaseBrowser` esiste
ma non è importato da nessuno: se ti serve, leggi il commento dentro prima.

**I repository ricevono il client come primo argomento** (`getRosa(db, {...})`),
non se lo costruiscono. Serve per i test: la stessa funzione eseguita con un
client autenticato come allenatore e come dirigente deve dare risultati diversi, ed
è così che si verificano le RLS.

**Le pagine orchestrano.** Recuperano dati e compongono componenti. Nessuna sopra
le ~150 righe: se cresce, dentro c'è un componente da estrarre.

**Le Server Action restituiscono `Risultato<T>`**, non lanciano per i fallimenti
previsti. Le eccezioni restano per i bug veri e arrivano a `error.tsx`. Il
wrapper `eseguiAzione` fa la distinzione: un bug non deve somigliare a un errore
di validazione, altrimenti si sistema il messaggio invece della causa.

**Gli errori del database diventano messaggi italiani in un posto solo**
(`lib/errors/postgres.ts`), su chiave del nome esatto del vincolo. Se rinomini un
vincolo o un indice, quella mappa smette di funzionare in silenzio e l'utente
legge `duplicate key value violates unique constraint`.

## Test: cosa prova ciascun livello

| Suite | Cosa prova |
|---|---|
| `test:unit` | funzioni pure, traduzione errori, schemi zod |
| `test:db` | vincoli, view, **e la matrice RLS completa** — il cuore |
| `test:e2e` | i flussi: login, ruoli, navigazione stagioni, CRUD stagioni |

**La suite RLS si autovalida solo se ogni ruolo ha sia un test di permesso sia uno
di diniego.** Se l'impersonificazione si rompesse, `auth.uid()` sarebbe nullo,
ogni policy falsa, e **tutti i dinieghi passerebbero** mentre i permessi
fallirebbero. Un ruolo con `BYPASSRLS` sbaglia nel verso opposto. Non cancellare
né indebolire un test di permesso per arrivare al verde: trasforma l'intera
matrice in un falso verde, ed è l'unico modo di fallire che nessuno intercetta.

`tests/db/harness.ts` isola ogni test in una transazione con rollback e sa
impersonare utenti applicativi. Usalo per tutto ciò che parla direttamente a
Postgres.

## Convenzioni

- Nomi di dominio, tabelle, colonne, vincoli, funzioni, variabili e testi utente
  **in italiano**; parole chiave tecniche in inglese.
- Commit: prefisso convenzionale inglese (`feat:`, `fix:`, `chore:`), corpo in
  italiano che spiega **perché**, non cosa.
- I file di migration sono immutabili una volta deployati. Finché il baseline non
  è deployato si correggono in place: una migration di rattoppo su un baseline mai
  deployato è il primo passo verso le 47 con nove numeri duplicati del sistema
  vecchio.

## Debito noto

**L'harness dei test non copre i repository, ed è il primo task della fase 2.**
`inRollback` avvolge un `pg.Client` grezzo. I repository usano un
`SupabaseClient`, che parla HTTP a PostgREST: quello prende una connessione dal
pool per richiesta, quindi non esiste sessione in cui un `BEGIN` possa vivere e
non c'è transazione da annullare. **`inRollback` non è estendibile** — chi prova
perde una giornata a scoprirlo.

Serve un harness *diverso*: un client che impersona un ruolo via JWT firmato col
`JWT_SECRET` locale, più pulizia per id tracciati invece di `delete()`. Entrambe
le metà hanno già un precedente funzionante nel repo (`sessione.test.ts`).

Perché prima di scrivere un nuovo repository: le fasi 2-4 ne aggiungono nove, e
col pattern attuale ognuno vuole un `beforeEach` che svuota le tabelle in ordine
topologico. Otto copie di quello non sono un costo di manutenzione, sono una
fabbrica di fallimenti che puntano al file sbagliato.

Gli altri finding differiti sono nel ledger, sezione per task.

## Trappole già pagate

Vedi `docs/TRAPPOLE.md`. Leggilo prima di scrivere migration o test: contiene otto
modi di fallire che hanno superato una review ciascuno, tutti della stessa
famiglia — **producono verde**.
