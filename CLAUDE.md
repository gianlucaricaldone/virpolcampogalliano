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

## Stato: fondamenta e funzionalità cardine, complete

La fase 1 ha costruito le fondamenta — schema, autorizzazione, autenticazione,
shell del backoffice. Il piano 2 (`docs/superpowers/plans/2026-07-29-funzionalita-cardine.md`)
ha portato a schermo le sette funzionalità richieste. Quel che resta:

| Fase | Contenuto | Stato |
|---|---|---|
| 2-4 | anagrafica, squadre, tesseramenti e staff, quote, visita medica, presenze, cruscotto, statistiche | fatte, piano `funzionalita-cardine` |
| — | admin utenti (creazione profili dal backoffice) | non fatta |
| 5 | sito pubblico | da fare |
| 6 | script di migrazione dati e cutover | da fare |

Le sette funzionalità richieste sono a schermo. Resta fuori dal piano 2 la
gestione degli utenti applicativi dal backoffice: i profili si creano con
`seed:dev` o a mano.

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
npm run db:reset            # applica le 7 migration da zero
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

**Le regole di business vivono solo nello SQL.** Stato quota, livello che
determina l'importo, stato della visita medica, percentuali per giocatore e per
squadra: esistono in `v_quote`, `v_visite`, `v_presenze`, `v_presenze_squadra` e
in nessuna copia TypeScript. Due implementazioni divergono, e quando divergono
l'elenco dice "parziale" mentre la scheda dice "saldato". `lib/domain/` contiene
solo funzioni pure di formattazione (`denaro`, `data`, `visita`, `stagione`), mai
regole: `descrizioneVisita` traduce in una frase uno stato che ha già deciso la
view, non lo calcola.

Se ti serve un valore che una view non espone, **si estende la view**. È stato
fatto due volte in questo piano: `livello_importo` su `v_quote`, e stagione,
squadra e persona su `v_quote` e `v_presenze` — senza, ogni elenco avrebbe
ricucito i dati in TypeScript.

**Le RLS sono la difesa primaria, i controlli applicativi la seconda.**
`richiediRuolo` in una Server Action dà un messaggio leggibile; la policy regge
anche se un'azione nuova dimentica quella riga. Nessun controllo di ruolo nel
middleware: il sistema vecchio ne aveva uno su un matcher sbagliato che non
scattava mai e nulla lo segnalava.

**La chiave service role sta solo in `scripts/`.** Quel client scavalca ogni
policy. Una regola ESLint vieta di importare `lib/supabase/admin` **e**
`scripts/env` da `app/`, `components/` e `lib/repos/`, con fixture sotto test —
se la regola smette di scattare, un test diventa rosso.

L'unica eccezione è `app/(app)/admin/utenti/actions.ts`, che crea gli account
in `auth.users` — cosa che la chiave anon non può fare. È un file solo, non una
cartella, così un `'use client'` vicino non può trascinare la chiave nel
bundle. Su Vercel serve quindi `SUPABASE_SERVICE_ROLE_KEY` fra le variabili
d'ambiente.

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

**Fra un `notFound()` e la radice non deve esserci nessun `loading.tsx`.** Il
confine Suspense avvolge tutto ciò che sta sotto il suo segmento, layout
annidati compresi: con lo streaming avviato lo status è già 200, e la not-found
viene servita con 200. Lo scheletro del cruscotto vive per questo nel gruppo di
rotta `(cruscotto)`, che non cambia l'URL e lascia fuori le rotte sorelle. Ogni
rotta di dettaglio nuova vuole un E2E che asserisca `response.status()`: è
l'unica assertion che distingue i due casi. Vedi `docs/TRAPPOLE.md` §7, dove la
regola scritta dopo la fase 1 era sbagliata e il piano 2 l'ha corretta.

**Gli id nell'URL vanno controllati nella forma prima di arrivare a Postgres.**
Un segmento che non è un uuid diventa `22P02`, cioè un 500 al posto di un 404:
i loader in `dati.ts` di ogni rotta di dettaglio lo verificano con una regex.

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
| `test:unit` | funzioni pure, traduzione errori, schemi zod, formattazione |
| `test:db` | vincoli, view, i repository eseguiti come tre ruoli diversi, **e la matrice RLS completa** — il cuore |
| `test:e2e` | i flussi: accesso, stagioni, anagrafica, squadre, tesseramenti, quote, visita, presenze, scadenze, statistiche |

**La suite RLS si autovalida solo se ogni ruolo ha sia un test di permesso sia uno
di diniego.** Se l'impersonificazione si rompesse, `auth.uid()` sarebbe nullo,
ogni policy falsa, e **tutti i dinieghi passerebbero** mentre i permessi
fallirebbero. Un ruolo con `BYPASSRLS` sbaglia nel verso opposto. Non cancellare
né indebolire un test di permesso per arrivare al verde: trasforma l'intera
matrice in un falso verde, ed è l'unico modo di fallire che nessuno intercetta.

### Due harness, e quale usare

`tests/db/harness.ts` (`inRollback`) avvolge un `pg.Client` e isola con
BEGIN/ROLLBACK. Serve per **vincoli e view**: ciò che si verifica parlando SQL
diretto.

`tests/db/harness-repo.ts` serve per i **repository**. `inRollback` non è
estendibile a loro: un `SupabaseClient` parla HTTP a PostgREST, che prende una
connessione dal pool a ogni richiesta, quindi non esiste sessione in cui un
`BEGIN` possa vivere e non c'è nulla da annullare. L'isolamento è per id
tracciati — `traccia()`, `pulisci()`, `conPulizia()` — e la pulizia rilegge le
righe cancellate prima di dichiararsi riuscita, perché una `delete` che non
trova nulla riesce in silenzio. `clientPerRuolo` crea un utente Auth vero e lo
autentica con `signInWithPassword`: un JWT firmato a mano col `JWT_SECRET`
locale sarebbe più veloce, ma sarebbe un secondo modo di produrre un token, e i
test continuerebbero a passare su un percorso che l'applicazione non usa più.

**Mai `delete().neq()` in un test.** Svuota una tabella condivisa con il seed e
con le altre suite, e il fallimento emerge in un file che non l'ha toccata.

**I test che dipendono da `current_date` chiedono la data al database**, non a
Node: le view la confrontano col fuso del server, il processo di test ha quello
della macchina, e vicino a mezzanotte i due differiscono di un giorno.

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

**Nessun export CSV delle statistiche.** Il piano 2 lo dava per facoltativo.

**`components/quote/PannelloQuota.tsx` è il componente più grosso (~180 righe)**:
dentro ci sono un riepilogo, un registro di versamenti e un form. Si divide
quando qualcuno dovrà toccarlo, non prima.

Gli altri finding differiti sono nel ledger, sezione per task.

## Trappole già pagate

Vedi `docs/TRAPPOLE.md`. Leggilo prima di scrivere migration o test: contiene otto
modi di fallire che hanno superato una review ciascuno, tutti della stessa
famiglia — **producono verde**.
