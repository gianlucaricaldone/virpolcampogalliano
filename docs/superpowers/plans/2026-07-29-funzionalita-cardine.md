# Funzionalità cardine — Implementation Plan (piano 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare su schermo le sette funzionalità richieste — inserimento giocatori e allenatori, squadre, assegnazioni, presenze agli allenamenti, quota di iscrizione, visita medica — più il cruscotto scadenze e le statistiche presenze.

**Architecture:** Nessuna novità architetturale. Lo schema, le RLS e i pattern esistono e sono documentati in `CLAUDE.md` e `docs/ARCHITETTURA.md` del repo di lavoro. Ogni task aggiunge un repository, le sue Server Action e le pagine che le consumano, seguendo `lib/repos/stagioni.ts` e `app/(app)/admin/stagioni/` come modelli già revisionati.

**Tech Stack:** invariato — Next.js 15, React 19, TypeScript, Supabase (Postgres 17+), zod, Vitest 4, Playwright.

**Repo di lavoro:** `~/Progetti/virpolcampogalliano-v2`, ramo `fondamenta` (o un ramo nuovo per questo piano, decisione al dispatch del Task 1).

## Processo, e perché è più leggero del piano 1

Il piano 1 ha applicato la stessa macchina di review alla matrice RLS e al README. Sul primo ha trovato che `anon` poteva cancellare l'anagrafica dei minori; sul secondo era ceremonia. Le funzionalità di questo piano sono CRUD su uno schema **già chiuso e testato**: un errore in una schermata si vede al primo click, un errore in una policy si scopre quando qualcuno legge dati che non deve. Quindi:

- **Una review per gruppo di task**, non per task. Tre gruppi: anagrafica e squadre (1-4), quote e visita (5-6), presenze e statistiche (7-9).
- **Fix loop solo su Critical e Important.** I Minor vanno nel ledger e li tria la review finale del piano.
- **Reviewer su modello standard**, tranne dove un task tocca una policy o un privilegio: lì Opus.
- **Nessuna nuova policy RLS senza un test di permesso e uno di diniego per ruolo.** Questa non si comprime: è la regola che ha tenuto in piedi il piano 1.

## Global Constraints

Valgono tutte quelle di `CLAUDE.md` nel repo di lavoro. Le ripeto solo dove questo piano le mette sotto pressione:

- **Nessuna regola di business in TypeScript.** Stato quota, stato visita e percentuali vivono in `v_quote` e `v_presenze`. Le pagine leggono, non calcolano. Se ti serve un valore che la view non espone, si estende la view.
- **L'allenatore non vede quote né pagamenti.** Le due tabelle finanziarie non hanno policy per lui, e le pagine che le leggono chiamano `richiediRuolo(db, ['admin','dirigente'])`.
- **La stagione viene dall'URL**, sempre. Nessuna pagina di questo piano deriva la stagione per conto proprio: la riceve dal segmento di rotta.
- **Nessuna pagina sopra le ~150 righe.** Le pagine orchestrano.
- **`notFound()` va in un `layout.tsx`, non in un `page.tsx`, per ogni rotta di dettaglio.** Questo piano aggiunge `[stagione]/squadre/[squadraId]`, `[stagione]/tesseramenti/[tesseramentoId]` e simili — esattamente i posti dove `notFound()` è naturale. Ma `app/(app)/[stagione]/loading.tsx` esiste e crea un confine Suspense: tutto ciò che sta **sotto** di lui va in streaming, e una volta che la risposta inizia a fluire lo status HTTP è già impegnato a 200. Un `notFound()` in una pagina sotto quel confine **restituisce 200** — verificato con una pagina sonda durante la review del piano 1. In un layout del segmento di dettaglio, invece, il controllo gira prima che lo shell venga inviato e il 404 resta un 404.
  **E ogni rotta di dettaglio nuova vuole un test E2E che asserisca `response.status()`**, non solo l'assenza di contenuto: è l'unica assertion che distingue i due casi, e senza di lei un monitor o una regola di retry lato client vengono ingannati in silenzio.
- Nomi di dominio e testi utente in italiano; parole chiave tecniche in inglese.
- Commit: prefisso convenzionale inglese, corpo italiano che spiega perché.

---

## Task 1 — Harness per i repository (prerequisito, non una funzionalità)

**Perché è il primo.** `inRollback` avvolge un `pg.Client`. I repository usano un `SupabaseClient`, che parla HTTP a PostgREST: quello prende una connessione dal pool per richiesta, quindi non esiste sessione in cui un `BEGIN` possa vivere. **`inRollback` non è estendibile.** Senza un harness diverso, ogni repository di questo piano porta con sé un `beforeEach` che svuota tabelle in ordine topologico — e con nove repository sono nove occasioni di sbagliare l'ordine, di ingoiare l'errore e di cancellare il seed da cui dipendono gli E2E.

Serve anche per una ragione che vale più della comodità: `lib/repos/*.ts` prende il client come primo argomento **proprio** per poter essere eseguito come ruoli diversi. Su questo ramo quella capacità non è ancora sfruttata da nessun test. Da qui in avanti è il modo in cui si verifica che un allenatore non legga le quote passando dal repository.

**Files:**
- Create: `tests/db/harness-repo.ts`
- Create: `tests/db/harness-repo.test.ts`

**Produces:**
- `clientPerRuolo(ruolo: 'admin'|'dirigente'|'allenatore', opzioni?: { personaId?: string }): Promise<{ db: SupabaseClient<Database>, userId: string, personaId: string | null }>` — crea utente Auth e profilo, restituisce un client autenticato come quell'utente
- `clientServizio(): SupabaseClient<Database>` — service role, per predisporre dati e per la pulizia
- `traccia(tabella: string, id: string): void` e `pulisci(): Promise<void>` — registro degli id creati e cancellazione in ordine inverso di dipendenza
- Un `afterAll` esportato o un helper `conPulizia(fn)` — decidi la forma, ma la pulizia deve girare anche se un test lancia

- [ ] **Step 1: Scrivere il test dell'harness stesso**

L'harness è infrastruttura: va testato come tale. Almeno questi casi:

```ts
it('un client come allenatore vede solo le sue squadre', ...)
it('un client come dirigente vede tutte le squadre', ...)
it('due client di ruoli diversi vedono risultati diversi dalla stessa funzione', ...)
it('pulisci() rimuove tutto ciò che è stato tracciato e nulla di più', ...)
it('pulisci() gira anche se il corpo del test lancia', ...)
```

Il terzo è quello che conta: è la proprietà per cui l'harness esiste. Usa `elencaStagioni` o un repository già esistente come cavia, così il test non dipende da codice di questo piano.

- [ ] **Step 2: Eseguire e osservare il rosso**

Run: `npm run test:db -- harness-repo`
Expected: FAIL, il modulo non esiste.

- [ ] **Step 3: Implementare**

Due approcci possibili per l'autenticazione, e la scelta va motivata nel report:

1. **JWT firmato localmente** col `JWT_SECRET` dell'istanza, passato come header `Authorization`. Nessun round trip ad Auth, veloce, ma dipende dal segreto locale.
2. **`signInWithPassword` reale**, come fa già `tests/db/sessione.test.ts`. Più lento di un round trip per client, ma usa lo stesso percorso dell'applicazione.

Preferisci (2) se la differenza di tempo è tollerabile: usa il percorso reale e non può divergere dal comportamento di produzione. Misura e riporta.

La pulizia va in ordine inverso di dipendenza: `presenze`, `pagamenti_quota`, `quote_importi`, `incarichi_staff`, `tesseramenti`, `sedute_allenamento`, `squadre`, `stagioni`, `profili`, `auth.users`, `persone`. Cancella **solo** per id tracciati: mai un `delete().neq()`, che è il pattern che questo task esiste per eliminare.

- [ ] **Step 4: Verificare e committare**

Run: `npm run db:reset && npm run test:db && npm run test:unit`
Poi: due esecuzioni consecutive di `test:db` devono dare conteggi identici. Un harness che ripulisce è idempotente.

- [ ] **Step 5: Convertire le due suite esistenti che usano `delete().neq()`**

`tests/db/repo-stagioni.test.ts` e `tests/db/repo-stagioni-scrittura.test.ts`. Non è scope creep: sono le due suite che il nuovo harness esiste per sostituire, e lasciarle indietro significa lasciare il pattern in circolazione come esempio da imitare.

---

## Task 2 — Anagrafica persone

Prima funzionalità richiesta: **inserimento giocatori** e **inserimento allenatori**. Entrambi sono `persone`: l'anagrafica è unica e permanente, il ruolo lo dà l'appartenenza per stagione (Task 3 e 4).

**Files:**
- Create: `lib/repos/persone.ts`, `lib/validation/persona.ts`
- Create: `app/(app)/anagrafica/page.tsx`, `nuova/page.tsx`, `[personaId]/page.tsx`, `actions.ts`
- Create: `components/persone/FormPersona.tsx`, `TabellaPersone.tsx`
- Create: `tests/db/repo-persone.test.ts`, `tests/unit/persona.test.ts`, `e2e/anagrafica.spec.ts`

**Produces:**
- `elencaPersone(db, filtro?: { cognome?: string; soloAttive?: boolean }): Promise<Persona[]>`
- `personaPerId(db, id): Promise<Persona | null>`
- `creaPersona(db, dati: NuovaPersona): Promise<Persona>`
- `aggiornaPersona(db, id, dati: Partial<NuovaPersona>): Promise<void>`
- `archiviaPersona(db, id): Promise<void>` — imposta `attiva = false`, non cancella

**Punti che richiedono attenzione:**

- `codice_fiscale` è `unique` ma **nullable**: per i minori spesso manca. Il form lo accetta vuoto e lo salva `null`, non stringa vuota — una stringa vuota collide con la successiva. Il vincolo di unicità dà `persone_codice_fiscale_key`, già nella mappa di traduzione errori.
- La scheda persona mostra lo **storico di tutte le stagioni**: tesseramenti e incarichi, ordinati per stagione decrescente. È la ragione per cui l'anagrafica è separata dall'appartenenza.
- `archiviaPersona` non cancella. Le FK verso `persone` sono `on delete restrict` proprio per impedirlo: un giocatore con storico non si cancella, si disattiva.
- L'allenatore vede solo le persone delle proprie squadre (policy `persone_sel_allenatore`). L'elenco per lui è quindi legittimamente parziale: **serve un test che lo dimostri**, non un test che assuma il punto di vista del dirigente.

**Test minimi:** repo con i tre ruoli via il nuovo harness (dirigente vede tutte, allenatore solo le sue, admin tutte); unicità del codice fiscale; archiviazione che non cancella; E2E di creazione con messaggio d'errore tradotto sul duplicato.

---

## Task 3 — Squadre

**Files:**
- Create: `lib/repos/squadre.ts`, `lib/validation/squadra.ts`
- Create: `app/(app)/[stagione]/squadre/page.tsx`, `nuova/page.tsx`, `[squadraId]/page.tsx`, `actions.ts`
- Create: `components/squadre/FormSquadra.tsx`, `TabellaSquadre.tsx`
- Create: `tests/db/repo-squadre.test.ts`, `e2e/squadre.spec.ts`

**Produces:**
- `elencaSquadre(db, stagioneId): Promise<Squadra[]>`
- `squadraPerId(db, id): Promise<Squadra | null>`
- `creaSquadra(db, { stagioneId, nome, categoria, annata }): Promise<Squadra>`
- `aggiornaSquadra(db, id, dati): Promise<void>`
- `eliminaSquadra(db, id): Promise<void>`

**Punti che richiedono attenzione:**

- La squadra appartiene a una stagione, e la stagione viene **dall'URL**. Non passare `stagioneCorrente` qui.
- `UNIQUE (stagione_id, nome)` dà `squadre_stagione_id_nome_key`, già tradotto.
- Le scritture sono negate su stagione chiusa dalle policy. La pagina deve riflettere la sola lettura, non scoprirlo con un errore: il layout `[stagione]` già espone il flag.
- Cancellare una squadra porta via sedute, presenze e incarichi per cascade, e azzera `squadra_id` sui tesseramenti lasciando la stagione. È testato dal piano 1: qui serve solo che l'interfaccia lo **dica** prima di farlo.

---

## Task 4 — Assegnazioni: tesseramenti e incarichi staff

Terza e quarta funzionalità richieste: **assegnazione giocatori e allenatori a squadre**.

**Files:**
- Create: `lib/repos/tesseramenti.ts`, `lib/repos/incarichi.ts`, `lib/validation/tesseramento.ts`
- Create: `app/(app)/[stagione]/tesseramenti/page.tsx`, `nuovo/page.tsx`, `[tesseramentoId]/page.tsx`, `actions.ts`
- Modify: `app/(app)/[stagione]/squadre/[squadraId]/page.tsx` — rosa e staff
- Create: `components/tesseramenti/*`, `components/incarichi/*`
- Create: `tests/db/repo-tesseramenti.test.ts`, `e2e/tesseramenti.spec.ts`

**Produces:**
- `elencaTesseramenti(db, stagioneId, filtro?: { squadraId?: string })`
- `creaTesseramento(db, { personaId, stagioneId, squadraId, numeroMaglia })`
- `assegnaSquadra(db, tesseramentoId, squadraId | null)`
- `impostaNumeroMaglia(db, tesseramentoId, numero | null)`
- `elencaIncarichi(db, squadraId)`, `creaIncarico(db, {...})`, `rimuoviIncarico(db, id)`

**Punti che richiedono attenzione:**

- Il flusso di tesseramento **cerca nell'anagrafica**, non reinserisce: campo di ricerca per cognome, selezione, poi assegnazione. Se la persona non esiste, si crea da lì. È la decisione presa nello spec contro il rollover automatico.
- `UNIQUE (persona_id, stagione_id)` — una persona, un tesseramento per stagione. Errore già tradotto.
- Il numero di maglia è unico per squadra fra i non-null: `tesseramenti_squadra_maglia_uidx`, già tradotto. Il messaggio nomina il giocatore che ce l'ha: serve una query in più per ottenerlo, e va fatta.
- **`squadra_id` nullable è un caso reale**, non un residuo: un tesserato può esistere senza squadra. L'elenco deve avere un filtro "senza squadra".
- Spostare un tesseramento con presenze già registrate **viene rifiutato** dal vincolo differito. Il messaggio deve spiegare che si cancellano prima le presenze, oppure che si fa nella stessa transazione — è documentato nel commento del vincolo.
- Un allenatore può leggere la rosa della propria squadra ma **non modificarla**. Test di diniego obbligatorio.

---

## Task 5 — Quote e pagamenti

Sesta funzionalità: **segnare se un giocatore ha pagato la quota, intera o metà.**

**Files:**
- Create: `lib/repos/quote.ts`
- Create: `app/(app)/[stagione]/quote/page.tsx`, `actions.ts`
- Modify: `app/(app)/[stagione]/tesseramenti/[tesseramentoId]/page.tsx` — pannello quota
- Create: `components/quote/*`
- Create: `tests/db/repo-quote.test.ts`, `e2e/quote.spec.ts`

**Produces:**
- `statoQuote(db, stagioneId): Promise<RigaQuota[]>` — legge `v_quote`, non ricalcola
- `impostaImporto(db, { stagioneId?, squadraId?, tesseramentoId? }, importo)`
- `registraPagamento(db, { tesseramentoId, importo, data, metodo, note })`
- `elencaPagamenti(db, tesseramentoId)`
- `annullaPagamento(db, id)`

**Punti che richiedono attenzione:**

- **Lo stato non si calcola in TypeScript.** `v_quote` restituisce `quota_attesa`, `pagato`, `residuo`, `stato`. La pagina mostra quei valori. Se serve altro, si estende la view.
- "Metà" non è un caso speciale: è un versamento di importo pari a metà. L'interfaccia può offrire un pulsante che precompila l'importo, ma il modello resta un registro.
- Un sovra-pagamento resta `saldato` con `residuo` negativo. L'interfaccia lo presenta come **credito**, non come errore.
- Gli importi si configurano su tre livelli, e la risoluzione è `COALESCE(tesseramento, squadra, stagione, 0)`. La pagina deve rendere visibile **quale livello** sta determinando l'importo atteso, altrimenti un override di squadra sembra un errore di calcolo.
- Le scritture sono vincolate a stagione aperta, incluse quelle su `quote_importi` — corretto durante la review finale del piano 1 proprio perché modificare l'importo di una stagione chiusa alterava retroattivamente lo stato di ogni tesseramento.
- **L'allenatore non vede nulla di tutto questo.** Le pagine chiamano `richiediRuolo(db, ['admin','dirigente'])` e un test E2E lo verifica navigando l'URL come allenatore.

---

## Task 6 — Visita medica

Settima funzionalità: **inserimento se un giocatore ha portato la visita medica sportiva.**

**Files:**
- Modify: `lib/repos/tesseramenti.ts` — `impostaVisita`
- Modify: `app/(app)/[stagione]/tesseramenti/[tesseramentoId]/page.tsx`
- Create: `lib/domain/visita.ts` **solo se** serve formattazione, non per lo stato
- Create: `tests/db/repo-visita.test.ts`

**Punti che richiedono attenzione:**

- **Lo stato si calcola dalla scadenza, non dalla consegna.** I dati storici che il piano 6 migrerà hanno solo un booleano e nessuna data di consegna: una regola basata sulla consegna marcherebbe ogni record migrato come mancante.
- Gli stati sono: mancante (`visita_scadenza` nulla), scaduta, in scadenza entro 30 giorni, valida. **Questa regola oggi non esiste in nessuna view.** Va aggiunta a `v_presenze`? No — va in una view sua, `v_visite`, oppure in `v_quote`? Decisione da prendere nel Task 6 e da motivare: la regola non deve finire in TypeScript, ma non deve nemmeno gonfiare una view che serve ad altro. **Proposta: una migration nuova che crea `v_visite`**, con i test dei quattro stati compresi i confini (esattamente 30 giorni, esattamente oggi).
- Nessun file caricato. È una decisione dello spec: il certificato è un dato sanitario e conservarlo richiede bucket privato, URL firmati e policy di cancellazione.

---

## Task 7 — Sedute e foglio presenze

Quinta funzionalità: **segnare le presenze dei giocatori agli allenamenti.**

**Files:**
- Create: `lib/repos/presenze.ts`
- Create: `app/(app)/[stagione]/presenze/page.tsx`, `[squadraId]/page.tsx`, `[squadraId]/[sedutaId]/page.tsx`, `actions.ts`
- Create: `components/presenze/FoglioPresenze.tsx`, `ElencoSedute.tsx`
- Create: `tests/db/repo-presenze.test.ts`, `e2e/presenze.spec.ts`

**Produces:**
- `elencaSedute(db, squadraId): Promise<Seduta[]>`
- `creaSeduta(db, { squadraId, stagioneId, data, oraInizio, note })`
- `getFoglio(db, sedutaId): Promise<{ seduta: Seduta; righe: RigaPresenza[] }>` — seduta, rosa e presenze già registrate in **una** query
- `salvaPresenze(db, sedutaId, righe: { tesseramentoId, stato }[])` — **un** upsert per tutte le righe

**Punti che richiedono attenzione:**

- **È l'unica schermata di questo piano con interattività reale.** Venti giocatori sono un upsert di venti righe su `UNIQUE (seduta_id, tesseramento_id)`, non venti chiamate. Con `useOptimistic` la spunta appare subito e torna indietro se l'azione fallisce — e il rollback deve essere **visibile**: una spunta che resta dopo un errore fa credere di aver salvato, e lo si scopre settimane dopo guardando le statistiche.
- `registraPresenza` nell'harness ricava `squadra_id` dalla seduta. Il repository deve fare lo stesso: mai chiedere `squadra_id` al chiamante.
- L'allenatore **può** scrivere presenze sulle proprie squadre. È il solo caso in cui scrive. Test di permesso e di diniego, e il diniego sulla seduta di un'altra squadra va scritto come insert diretta, perché il percorso che ricava la squadra dalla seduta non vede la riga altrui e solleverebbe l'errore sbagliato — vedi `docs/TRAPPOLE.md`.
- Su stagione chiusa la scrittura è negata dalle policy: la pagina mostra il foglio in sola lettura.

---

## Task 8 — Cruscotto scadenze

**Files:**
- Modify: `app/(app)/[stagione]/page.tsx` — sostituisce il segnaposto
- Create: `lib/repos/scadenze.ts`, `components/scadenze/*`
- Create: `tests/db/repo-scadenze.test.ts`, `e2e/scadenze.spec.ts`

Due elenchi, filtrabili per squadra: quote non saldate (da `v_quote`) e visite mancanti, scadute o in scadenza (da `v_visite` del Task 6). È la vista che serve a chi sollecita, e la ragione per cui vale poco codice e molto valore.

Un allenatore vede il cruscotto **senza la colonna quote**: la pagina compone due riquadri e ne rende uno solo per lui. Non nascondere la colonna via CSS — non chiamare il repository.

---

## Task 9 — Statistiche presenze

**Files:**
- Create: `app/(app)/[stagione]/statistiche/page.tsx`, `lib/repos/statistiche.ts`
- Create: `tests/db/repo-statistiche.test.ts`, `e2e/statistiche.spec.ts`

Legge `v_presenze`: percentuale per giocatore e per squadra, `non_registrate` accanto alla percentuale. Chi si tessera a gennaio ha percentuale bassa e `non_registrate` alto, ed è la lettura onesta — non aggiustare il denominatore per farla sembrare migliore, è il difetto per cui le statistiche del sistema vecchio non erano attendibili.

Export CSV se costa poco; non è un requisito.

---

## Ordine e dipendenze

```
1 harness          ← prerequisito di tutti
2 anagrafica       ← indipendente dopo 1
3 squadre          ← indipendente dopo 1
4 assegnazioni     ← richiede 2 e 3
5 quote            ← richiede 4
6 visita medica    ← richiede 4
7 presenze         ← richiede 4
8 cruscotto        ← richiede 5 e 6
9 statistiche      ← richiede 7
```

2 e 3 sono paralleli in teoria; in pratica un implementer alla volta sull'albero, quindi sequenziali.

**Review:** dopo 4 (gruppo anagrafica/squadre/assegnazioni), dopo 6 (gruppo quote/visita), dopo 9 (gruppo presenze/statistiche). Più una review finale del piano.
