# Riscrittura gestionale Virpol Campogalliano — Design

Data: 2026-07-29
Stato: approvato per la stesura del piano di implementazione

## 1. Obiettivo e perimetro

Riscrivere il gestionale della società sportiva come applicazione a organizzazione
singola con gestione multi-stagione nativa, su schema database e codebase nuovi.

### Funzionalità della fase 1

1. Inserimento giocatori (anagrafica)
2. Inserimento allenatori (anagrafica)
3. Inserimento squadre
4. Assegnazione di giocatori e allenatori alle squadre
5. Registrazione presenze dei giocatori agli allenamenti
6. Registrazione del pagamento della quota di iscrizione (intera o parziale)
7. Registrazione della visita medica sportiva
8. Statistiche e report presenze
9. Cruscotto scadenze (quote da saldare, visite mancanti o in scadenza)
10. Sito pubblico: home, squadre, contatti, dove siamo — stesso contenuto e
    stessa impostazione visiva di oggi, ricostruito come Server Component

### Fuori perimetro

Eliminate dal prodotto: **magazzino** e **gestione eventi**.

Rinviate a fasi successive con spec propri: partite, avversari, convocazioni,
locandine PDF, tornei, campi e calendario campi, economia e movimenti economici,
report allenatori, area personale per giocatori e genitori, ridisegno grafico
del sito pubblico.

Non è previsto il multi-tenant: nessun `organization_id` in nessuna tabella.

## 2. Decisioni prese

| Ambito | Decisione |
|---|---|
| Database | Progetto Supabase nuovo, schema baseline unico, dati migrati dal vecchio con script |
| Dove si costruisce | Repo nuovo in una directory sorella (`virpolcampogalliano-v2`), cutover unico; il repo attuale resta intatto come riferimento e fonte della migrazione |
| Modello persone | Anagrafica unica `persone` + `tesseramenti` (giocatori) + `incarichi_staff` (staff), per stagione |
| Presenze | La seduta di allenamento è un'entità; le presenze sono righe collegate alla seduta |
| Quote | Registro di versamenti, stato calcolato; importo atteso su tre livelli con override |
| Visita medica | Data di consegna e data di scadenza, nessun file caricato; lo stato si calcola dalla scadenza |
| Ruoli | `admin`, `dirigente`, `allenatore`. Nessun account per giocatori e genitori |
| Stagione | Segmento di URL (`/2026-27/...`), nessun flag `attiva` nel database |
| Nuova stagione | Popolamento da zero con ricerca sull'anagrafica permanente; nessun rollover automatico |
| Stack | Next.js 15 App Router, React 19, TypeScript, Supabase (`@supabase/ssr`), Tailwind, shadcn/ui |
| Data layer | `supabase-js` tipizzato dentro un layer di repository; RLS come difesa primaria |

### Motivi dei rifiuti

- **Schema riscritto in-place sullo stesso progetto**: significherebbe lavorare su
  produzione live, senza rollback praticabile.
- **Convivenza vecchio/nuovo nello stesso deploy**: impossibile con due progetti
  Supabase distinti — un tesserato creato nel nuovo non esisterebbe nel vecchio.
- **Drizzle ORM**: la connessione diretta a Postgres richiede di reimpostare il
  ruolo utente a ogni transazione perché le RLS continuino a valere; più pezzi da
  tenere allineati senza un beneficio proporzionato su query di questa complessità.
- **API routes REST come strato intermedio**: aggiunge un salto di rete a ogni
  lettura; le Server Action coprono già le mutazioni. Da riconsiderare solo se
  arriverà un client esterno (app mobile).
- **Rollover automatico delle rose**: nel calcio giovanile le rose si rimescolano
  per annata ogni anno, quindi la copia andrebbe comunque corretta a mano.
- **Upload dei certificati medici**: sono dati sanitari; conservarli richiede
  bucket privato, URL firmati e policy di cancellazione, per un beneficio marginale.

## 3. Modello dati

10 tabelle, 2 view.

```sql
-- ANAGRAFICA — permanente, attraversa le stagioni
persone
  id uuid pk, nome, cognome, data_nascita date,
  codice_fiscale text unique, email, telefono,
  indirizzo, citta, cap, provincia, note,
  attiva boolean default true,        -- archiviazione soft, mai DELETE
  created_at, updated_at

profili                                -- account applicativi (solo staff)
  id uuid pk references auth.users(id) on delete cascade,
  persona_id uuid references persone(id),
  ruolo ruolo_app not null,            -- admin | dirigente | allenatore
  attivo boolean default true,
  created_at, updated_at,
  CHECK (ruolo <> 'allenatore' OR persona_id IS NOT NULL)

-- STAGIONI
stagioni
  id uuid pk,
  codice text unique not null,         -- '2026-27', usato come segmento di URL
  etichetta text not null,             -- '2026/2027'
  data_inizio date not null, data_fine date not null,
  stato stato_stagione not null default 'aperta',   -- aperta | chiusa
  created_at, updated_at,
  CHECK (data_fine > data_inizio),
  CHECK (codice ~ '^\d{4}-\d{2}$')
  -- nessun flag `attiva`: la stagione corrente è derivata

squadre
  id uuid pk,
  stagione_id uuid not null references stagioni(id) on delete restrict,
  nome text not null, categoria text not null, annata int, note text,
  created_at, updated_at,
  UNIQUE (stagione_id, nome),
  UNIQUE (id, stagione_id)             -- appoggio per le FK composite

-- GIOCATORI, per stagione
tesseramenti
  id uuid pk,
  persona_id uuid not null references persone(id) on delete restrict,
  stagione_id uuid not null references stagioni(id) on delete restrict,
  squadra_id uuid,                     -- nullable = tesserato non ancora assegnato
  numero_maglia int CHECK (numero_maglia BETWEEN 1 AND 99),
  visita_consegnata_il date, visita_scadenza date,
  note text, created_at, updated_at,
  UNIQUE (persona_id, stagione_id),
  FOREIGN KEY (squadra_id, stagione_id) REFERENCES squadre(id, stagione_id)

-- il vincolo sulla maglia è un indice parziale, non un table constraint:
-- Postgres non supporta WHERE nelle UNIQUE dichiarate inline
CREATE UNIQUE INDEX tesseramenti_squadra_maglia_uidx
  ON tesseramenti (squadra_id, numero_maglia)
  WHERE numero_maglia IS NOT NULL;

-- STAFF, per stagione
incarichi_staff
  id uuid pk,
  persona_id uuid not null references persone(id) on delete restrict,
  stagione_id uuid not null, squadra_id uuid not null,
  ruolo ruolo_staff not null,          -- allenatore | vice_allenatore | dirigente_squadra
  created_at,
  UNIQUE (persona_id, squadra_id, ruolo),
  FOREIGN KEY (squadra_id, stagione_id) REFERENCES squadre(id, stagione_id)

-- QUOTE
quote_importi                          -- tutti gli importi vivono qui, e solo qui
  id uuid pk,
  stagione_id uuid null,               -- importo di default della stagione
  squadra_id uuid null,                -- override per squadra
  tesseramento_id uuid null,           -- override per singolo giocatore
  importo numeric(10,2) not null CHECK (importo >= 0),
  note text, created_at, updated_at,
  CHECK (num_nonnulls(stagione_id, squadra_id, tesseramento_id) = 1),
  UNIQUE (stagione_id), UNIQUE (squadra_id), UNIQUE (tesseramento_id)
  -- le tre UNIQUE convivono perché per riga due colonne su tre sono NULL e
  -- Postgres considera i NULL distinti: NON aggiungere NULLS NOT DISTINCT qui

pagamenti_quota
  id uuid pk,
  tesseramento_id uuid not null references tesseramenti(id) on delete cascade,
  importo numeric(10,2) not null CHECK (importo > 0),
  data date not null,
  metodo metodo_pagamento not null default 'contanti',   -- contanti | bonifico | altro
  note text,
  registrato_da uuid references profili(id),
  created_at

-- PRESENZE
sedute_allenamento
  id uuid pk,
  squadra_id uuid not null, stagione_id uuid not null,
  data date not null, ora_inizio time, note text,
  created_by uuid references profili(id),
  created_at, updated_at,
  UNIQUE NULLS NOT DISTINCT (squadra_id, data, ora_inizio),
  FOREIGN KEY (squadra_id, stagione_id) REFERENCES squadre(id, stagione_id)

presenze
  id uuid pk,
  seduta_id uuid not null references sedute_allenamento(id) on delete cascade,
  tesseramento_id uuid not null references tesseramenti(id) on delete cascade,
  stato stato_presenza not null,       -- presente | assente | giustificato | infortunato
  note text, created_at, updated_at,
  UNIQUE (seduta_id, tesseramento_id)
```

Enum: `ruolo_app`, `ruolo_staff`, `stato_stagione`, `stato_presenza`, `metodo_pagamento`.

**Postgres 17 o superiore è obbligatorio.** Due costrutti lo impongono:
`UNIQUE NULLS NOT DISTINCT` su `sedute_allenamento` richiede 15, ma la revoke
del privilegio `MAINTAIN` nelle policy richiede 17 — quel privilegio non
esisteva prima. Provisionare un progetto su 15 fa fallire il parsing della
migration delle RLS **dopo** che le cinque precedenti sono già state
applicate: si resterebbe con tabelle e viste in piedi, RLS mai abilitata e
nessuna policy. La versione va verificata prima di applicare lo schema, non
dopo. `UNIQUE NULLS NOT DISTINCT` serve perché: serve perché due sedute nello stesso giorno con `ora_inizio` nulla
vanno considerate duplicate, mentre il comportamento predefinito le ammetterebbe.

### Scelte non ovvie

**FK composite `(squadra_id, stagione_id)`.** Nel vecchio schema un record di
associazione poteva puntare a una squadra di un'altra stagione senza che nulla lo
impedisse. Qui il database lo rifiuta. Richiede la `UNIQUE (id, stagione_id)` su
`squadre`, ridondante ma innocua.

**Stagione corrente derivata, non memorizzata.** `/` reindirizza alla prima
stagione con `stato = 'aperta'` ordinata per `data_inizio DESC`. Deterministico, e
a luglio — quando la stagione nuova è già aperta e la precedente non è ancora
chiusa — punta a quella nuova. Elimina il conflitto fra `stagioni_sportive.attiva`
e `parametri_sistema.stagione_corrente_id` del vecchio sistema.

**Nessuna colonna `vice_1` / `vice_2`.** `incarichi_staff` è una riga per incarico:
un allenatore può stare su più squadre, una squadra può avere quanti vice serve.

**`codice` vincolato dal database a `^\d{4}-\d{2}$`.** `[stagione]` convive con i
segmenti statici `anagrafica` e `admin`; Next risolve prima gli statici, e il
vincolo rende impossibile per costruzione una stagione che collida con essi.

**Tutti gli importi in `quote_importi`.** Motivazione in §6.

### View

```sql
v_quote      tesseramento_id, quota_attesa, pagato, residuo, stato
  quota_attesa = COALESCE(override del tesseramento,
                          override della squadra,
                          default della stagione, 0)   -- da quote_importi
  stato = quota_attesa = 0 ? 'saldato'
        : pagato = 0       ? 'non_pagato'
        : pagato < attesa  ? 'parziale'
        : 'saldato'
  -- pagato > attesa resta 'saldato' con residuo negativo:
  --    l'interfaccia lo presenta come credito

v_presenze   tesseramento_id, sedute_squadra, presenti, assenti,
             giustificati, infortuni, non_registrate, percentuale
  percentuale = presenti / sedute_squadra
  -- denominatore = tutte le sedute della squadra, comprese quelle senza
  --    riga per quel giocatore; `non_registrate` rende visibili i buchi
  --    invece di gonfiare la percentuale
```

Chi si tessera a metà stagione risulta con percentuale bassa e `non_registrate`
alto. È preferibile a un denominatore che nasconde le sedute non compilate: nel
vecchio sistema le statistiche erano inaffidabili proprio per quel motivo.

### Stato della visita medica

Si calcola **dalla scadenza**, non dalla consegna:

```
visita_scadenza IS NULL      -> mancante
visita_scadenza < oggi       -> scaduta
visita_scadenza <= oggi+30gg -> in_scadenza
altrimenti                   -> valida
```

`visita_consegnata_il` è informativo. La regola è dettata dalla migrazione: i dati
storici hanno solo il booleano `visita_sportiva` e nessuna data di consegna, mentre
la scadenza in molti casi c'è.

## 4. Routing e struttura

```
app/
  (public)/                    sito pubblico, statico + revalidate
    layout.tsx                 header/footer pubblici
    page.tsx                   home (~80 righe; oggi è 791)
    squadre/page.tsx
    contatti/page.tsx
    dove-siamo/page.tsx

  (auth)/
    login/page.tsx
    logout/route.ts

  (app)/                       backoffice, sessione obbligatoria
    layout.tsx                 guard sessione + shell (nav, selettore stagione)
    gestione/page.tsx          redirect -> /{stagione corrente}
                               -- NON `(app)/page.tsx`: risolverebbe a `/` come
                               --    `(public)/page.tsx` e Next rifiuta due pagine
                               --    parallele sullo stesso percorso

    [stagione]/
      layout.tsx               risolve codice -> stagione, notFound() se assente,
                               espone la stagione e il flag di sola lettura
      page.tsx                 cruscotto scadenze
      squadre/
        page.tsx
        nuova/page.tsx
        [squadraId]/page.tsx           rosa + staff
        [squadraId]/modifica/page.tsx
      tesseramenti/
        page.tsx                       elenco + filtri (squadra, quota, visita)
        nuovo/page.tsx                 cerca in anagrafica oppure crea persona
        [tesseramentoId]/page.tsx      quota e pagamenti, visita, squadra, maglia
      presenze/
        page.tsx                       scelta squadra
        [squadraId]/page.tsx           elenco sedute + nuova seduta
        [squadraId]/[sedutaId]/page.tsx  foglio presenze
      statistiche/page.tsx

    anagrafica/                fuori da [stagione]: le persone non sono stagionali
      page.tsx
      nuova/page.tsx
      [personaId]/page.tsx     scheda + storico di tutte le stagioni

    admin/
      stagioni/page.tsx
      utenti/page.tsx          profili e ruoli

lib/
  supabase/
    server.ts        client per Server Component e Server Action (cookie)
    browser.ts       client per i Client Component
    admin.ts         service role — SOLO script, mai importato da app/
  db/types.ts        generato con `supabase gen types typescript`
  repos/             persone, stagioni, squadre, tesseramenti, quote,
                     presenze, statistiche, profili
  auth/session.ts    getSessione(), richiediRuolo()
  validation/        schemi zod, uno per form/action
  errors/postgres.ts traduzione dei codici di errore
  env.ts             validazione delle variabili d'ambiente all'avvio
  domain/            funzioni pure: parsing codice stagione, formattazioni,
                     etichette — NON regole di business duplicate

components/
  ui/                shadcn/ui
  <dominio>/         componenti per area funzionale
```

**Regola sulla duplicazione della logica.** Stato quota, stato visita e percentuale
presenze esistono **solo** nelle view SQL, senza copia in TypeScript. Due
implementazioni divergono, e in quel caso l'elenco mostra "parziale" mentre la
scheda mostra "saldato". Si testano con Postgres locale, che serve comunque per
testare le RLS.

**Vincoli di dimensione.** Nessuna pagina sopra le ~150 righe: le pagine
orchestrano — recuperano dati e compongono componenti. Le Server Action stanno in
`actions.ts` accanto alla pagina che le usa.

## 5. Flusso dei dati

Si legge nei Server Component, si scrive nelle Server Action. Il browser non parla
mai direttamente con Supabase per dati di dominio.

```
LETTURA
  page.tsx (Server Component)
    -> supabaseServer()                        client con i cookie di sessione
    -> repos.presenze.getFoglio(db, { sedutaId })
         una query: seduta + rosa + presenze già registrate
    -> <FoglioPresenze dati={...} />           Client Component, dati come props

SCRITTURA
  <FoglioPresenze> submit
    -> Server Action salvaPresenze(sedutaId, righe)
         1. zod parse                          input non fidato
         2. richiediRuolo(...)                 autorizzazione applicativa
         3. repos.presenze.salva(db, ...)      un upsert per tutte le righe
         4. revalidatePath(...)
    -> Risultato<T>
```

I repo ricevono il client come primo argomento invece di crearselo dentro:

```ts
export async function getFoglio(db: Db, { sedutaId }: { sedutaId: string }) { ... }
export async function salva(db: Db, sedutaId: string, righe: RigaPresenza[]) { ... }
```

Serve per i test: la stessa funzione eseguita con un client autenticato come
allenatore e come dirigente deve dare risultati diversi, ed è così che si
verificano le RLS.

**Conseguenze:**

- Il foglio presenze salva in una chiamata: venti giocatori sono un `upsert` di
  venti righe su `UNIQUE (seduta_id, tesseramento_id)`. `useOptimistic` mostra la
  spunta subito e la riporta indietro se l'azione fallisce.
- Nessuna cache scritta a mano. Niente equivalente di `lib/supabase/query-cache.ts`
  né della cache auth con TTL di 5 minuti: Next deduplica dentro la richiesta e
  `revalidatePath` invalida dopo le mutazioni. Una cache auth di 5 minuti
  significherebbe anche un ruolo revocato ancora valido per 5 minuti.
- Caricamento a sezioni: ogni parte lenta dentro il proprio `<Suspense>` con
  skeleton. Non esiste uno stato di caricamento globale che un fetch fallito possa
  bloccare per sempre.
- Stagione chiusa: l'azione rifiuta la scrittura e la policy RLS la rifiuta di
  nuovo. La prima dà un messaggio leggibile, la seconda regge se un'azione nuova
  dimentica il controllo.

Il client fa solo: foglio presenze, filtri degli elenchi, dialog di registrazione
pagamento, selettore stagione.

## 6. Sicurezza e autorizzazione

### Perché tutti gli importi stanno in `quote_importi`

L'allenatore non deve vedere quote e pagamenti. Le RLS filtrano righe, non colonne:
se l'allenatore legge la riga di un tesseramento della sua squadra, vedrebbe anche
un eventuale `quota_override` su quella riga. Le GRANT per colonna non risolvono,
perché in Supabase tutti gli utenti applicativi condividono il ruolo Postgres
`authenticated`.

Secondo vincolo: `stagioni` e `squadre` devono essere leggibili senza login per il
sito pubblico. Con gli importi su quelle tabelle sarebbero raggiungibili con la
chiave anon, che è pubblica per definizione.

Entrambi i problemi si chiudono tenendo gli importi fuori da ogni tabella leggibile
da allenatori o da utenti anonimi. `quote_importi` e `pagamenti_quota` sono le due
tabelle finanziarie, negate all'allenatore con due policy.

### Funzioni helper e assenza di ricorsione

L'errore `infinite recursion detected in policy for relation "users"` del vecchio
sistema nasceva da una policy su `users` che interrogava `users`. Si evita con
funzioni `SECURITY DEFINER`, che non attivano le RLS della tabella che leggono:

```sql
create schema app;

create function app.mio_ruolo() returns ruolo_app
  language sql stable security definer set search_path = '' as $$
    select ruolo from public.profili where id = auth.uid() and attivo
  $$;

create function app.mia_persona() returns uuid
  language sql stable security definer set search_path = '' as $$
    select persona_id from public.profili where id = auth.uid() and attivo
  $$;

create function app.mie_squadre() returns setof uuid
  language sql stable security definer set search_path = '' as $$
    select squadra_id from public.incarichi_staff
    where persona_id = app.mia_persona()
  $$;
```

`set search_path = ''` è obbligatorio su ogni funzione `SECURITY DEFINER`: senza,
chi controlla il `search_path` può far risolvere `profili` a una propria tabella e
ottenere il ruolo che vuole. Con nomi qualificati e path vuoto l'attacco non è
possibile.

L'unica policy su `profili` non usa subquery e non può ricorrere:
`USING (id = auth.uid())`, più una per gli admin.

### Matrice delle policy

```
tabella              anon    allenatore              dirigente   admin
─────────────────────────────────────────────────────────────────────────
stagioni             SELECT  SELECT                  SELECT      ALL
squadre              SELECT  SELECT                  ALL         ALL
persone              —       SELECT (solo sue rose)  ALL         ALL
profili              —       solo la propria riga    SELECT      ALL
tesseramenti         —       SELECT (sue squadre)    ALL         ALL
incarichi_staff      —       SELECT (sue squadre)    ALL         ALL
sedute_allenamento   —       ALL (sue squadre)       ALL         ALL
presenze             —       ALL (sue squadre)       ALL         ALL
quote_importi        —       NEGATO                  ALL         ALL
pagamenti_quota      —       NEGATO                  ALL         ALL
```

Ogni policy di scrittura dichiara **sia `USING` sia `WITH CHECK`**. `USING` da solo
filtra ciò che si legge ma non valida ciò che si scrive: un `INSERT` mirato
inserirebbe righe su squadre altrui.

La condizione "stagione aperta" va **solo sulle policy di scrittura, mai su quelle
di lettura**. Una policy `FOR ALL` che include `stato = 'aperta'` nella `USING`
rende invisibili le stagioni chiuse invece di renderle in sola lettura, e lo storico
sparisce. Le policy si scrivono quindi separate per verbo: `FOR SELECT` senza
condizione sulla stagione, `FOR INSERT / UPDATE / DELETE` con la condizione.

```sql
-- lettura: nessuna condizione sulla stagione, lo storico resta consultabile
create policy presenze_sel_allenatore on presenze for select to authenticated
  using (   app.mio_ruolo() = 'allenatore'
        and seduta_id in (select id from sedute_allenamento
                          where squadra_id in (select app.mie_squadre())));

-- scrittura: solo stagioni aperte, e con WITH CHECK sulla riga in ingresso
create policy presenze_ins_allenatore on presenze for insert to authenticated
  with check ( app.mio_ruolo() = 'allenatore'
           and seduta_id in (select s.id from sedute_allenamento s
                             where s.squadra_id in (select app.mie_squadre())
                               and app.stagione_aperta(s.stagione_id)));
-- policy analoghe per update (using + with check) e delete (using)
```

`app.stagione_aperta(uuid)` è la quarta funzione helper, accanto alle tre sopra.

Per `anon` esistono due sole policy, su `stagioni` e `squadre`. Le altre otto
tabelle non hanno policy per `anon`: con RLS attiva, assenza di policy significa
nessun accesso. Il sito pubblico mostra i nomi delle squadre, non le rose: nessun
dato personale di minori è raggiungibile senza login.

### Autorizzazione applicativa

Il middleware fa una cosa sola: rinfresca il cookie di sessione e reindirizza al
login chi non è autenticato. **Nessun controllo di ruolo nel middleware** — è lì
che il vecchio sistema sbagliava, con un matcher su `/admin/*` mentre le pagine
stavano sotto `/dashboard/admin/*`, e un controllo che non scattava mai senza che
nulla lo segnalasse.

I ruoli si verificano in due punti non aggirabili: `richiediRuolo([...])` come prima
riga utile di ogni Server Action, e le RLS, che valgono anche se un'azione nuova
dimentica quella riga.

### Gestione delle chiavi

`SUPABASE_SERVICE_ROLE_KEY` vive solo negli script di migrazione, eseguiti a mano
da terminale. `lib/supabase/admin.ts` non è importabile da `app/**`, imposto con una
regola ESLint `no-restricted-imports` che fa fallire la build: è troppo facile
importarlo per far funzionare una query e spedire in produzione un client che
ignora ogni RLS.

`.env.example` contiene solo segnaposto, mai chiavi reali.

**Debito ereditato da chiudere.** Nel repo attuale `.env.local.example` è tracciato
in git e contiene la `SUPABASE_SERVICE_ROLE_KEY` reale del progetto di produzione;
`extra/pwdtxt.txt` è pure tracciato. La chiave va ruotata dalla dashboard Supabase:
rimuovere i file da HEAD non basta, restano leggibili nella history.

## 7. Gestione errori

Le azioni non lanciano eccezioni per i fallimenti previsti, restituiscono un
risultato tipizzato:

```ts
type Risultato<T> =
  | { ok: true; dati: T }
  | { ok: false; errore: string; campi?: Record<string, string> }
```

Le eccezioni restano per i bug veri e finiscono nell'`error.tsx` del gruppo di
rotte. Un bug non deve somigliare a un errore di validazione, altrimenti si
sistema il messaggio invece della causa.

I vincoli del database diventano messaggi in italiano in `lib/errors/postgres.ts`:

```
23505 unique_violation
  tesseramenti_squadra_maglia_uidx    -> "La maglia 10 è già di Mario Rossi"
  tesseramenti_persona_stagione_key   -> "Luca Verdi è già tesserato in questa stagione"
  sedute_squadra_data_ora_key         -> "Esiste già una seduta il 12/03 alle 18:00"
23503 foreign_key_violation           -> "Elemento collegato non più esistente, ricarica"
23514 check_violation                 -> messaggio specifico per vincolo
42501 insufficient_privilege          -> "Operazione non consentita"
        (è la RLS che rifiuta: stagione chiusa oppure squadra non propria.
         La Server Action controlla prima e dà il messaggio preciso; questo
         è il fallback quando il controllo applicativo manca)
```

Altri punti fermi:

- Uno schema zod per azione; gli errori per campo tornano in `campi` e
  `useActionState` li rende accanto all'input. La validazione client non sostituisce
  quella server.
- `lib/env.ts` valida le variabili d'ambiente con zod, invocata da `next.config.ts`
  a build time e da `instrumentation.ts` all'avvio del server. La guardia che conta
  è la prima: i valori `NEXT_PUBLIC_*` vengono inlineati nel bundle durante la
  build, quindi una variabile mancante fa fallire la build prima del deploy. La
  seconda da sola non basterebbe — un `register()` che lancia non termina il
  processo, il server resta in ascolto e risponde 500 a ogni richiesta, e un deploy
  passerebbe verde rompendosi per gli utenti. Il
  `{message: 'Supabase not configured'}` di oggi arriva invece a runtime dentro una
  query, travestito da errore di rete.
- Log senza dati personali: id ed evento, mai nomi, codici fiscali o email.
  `log.warn('presenze.salva.rifiutata', { sedutaId, profiloId, motivo })`. Nessun
  `console.log` sul percorso caldo, a differenza del middleware attuale che stampa
  ogni richiesta.
- `loading.tsx` con skeleton per rotta; ogni elenco vuoto dice cosa fare. Un codice
  stagione inesistente dà `notFound()`.
- Sul foglio presenze il rollback ottimistico è visibile, con avviso e motivo: una
  spunta che resta a schermo dopo un errore fa credere di aver salvato, e l'errore
  si scoprirebbe settimane dopo guardando le statistiche.

## 8. Test

```
Vitest unit          schemi zod, traduzione errori Postgres,
                     parsing codice stagione, formattazioni

Vitest + Postgres    il cuore della suite. `supabase start`, schema applicato, seed.
locale               - v_quote: nessun pagamento / metà / saldo / eccedenza /
                       override del tesseramento che vince su squadra e stagione
                     - v_presenze: percentuale con sedute non registrate,
                       giocatore tesserato a metà stagione
                     - vincoli: maglia duplicata, doppio tesseramento nella stessa
                       stagione, squadra di un'altra stagione via FK composita
                     - matrice RLS: 3 client (admin/dirigente/allenatore) × ogni
                       tabella, sia il permesso sia il diniego

Playwright E2E       login e ruoli; tesseramento con quota e visita;
                     compilazione foglio presenze con salvataggio

CI GitHub Actions    lint, type-check, unit, db-test, e2e, build
```

Nessun obiettivo di copertura percentuale; al suo posto una lista di invarianti con
un test dedicato ciascuno. Il più importante: **l'allenatore della squadra A non
legge la rosa di B e non inserisce presenze su una seduta di B**, in lettura e in
scrittura, separatamente.

Su view e vincoli il test si scrive prima dello SQL: sono logica pura con input e
output espliciti, e sono la parte dove un errore resta invisibile più a lungo,
perché una percentuale sbagliata non solleva eccezioni.

## 9. Migrazione dei dati

`scripts/migra.ts` in TypeScript legge dal progetto vecchio e scrive nel nuovo,
entrambi con service role, eseguito a mano da terminale. **Dry-run per default**,
scrive solo con `--esegui`. Idempotente su chiavi naturali (codice fiscale, codice
stagione, nome + stagione per le squadre), quindi rieseguibile senza duplicare.

```
tesserati                    -> persone                   (stato -> attiva)
users (staff)                -> persone + profili
  admin -> admin, dirigente -> dirigente,
  allenatore -> allenatore, vice_allenatore -> allenatore
  tesserato, genitore        -> scartati, nessun account
stagioni_sportive            -> stagioni
  nome '2024/2025' -> codice '2024-25' + etichetta
  archiviata -> stato 'chiusa', altrimenti 'aperta'
squadre                      -> squadre
tesserati_squadre_stagioni   -> tesseramenti (+ numero_maglia)
  + tesserati_dati_stagionali fusi sulla stessa riga
presenze (tipo=allenamento)  -> sedute_allenamento + presenze
  raggruppate per (squadra_id, data) -> una seduta
  presente bool -> presente | assente

SCARTATI: magazzino, eventi, economia, tornei, avversari, partite, campi,
          convocazioni, report_*, presenze di tipo partita/torneo/evento
          (tutti contati nel report)
```

### Tre punti dove i dati vecchi non contengono l'informazione necessaria

**Gli importi delle quote non esistono nello storico.** Il vecchio schema ha solo
`stato_pagamento` fra `pagato` / `parziale` / `non_pagato` / `in_sospeso`, senza
cifre. Lo script riceve la quota per stagione come parametro di input e ricostruisce:
`pagato` diventa un versamento pari all'intera quota, `parziale` metà quota, gli
altri due nessun versamento. La data è `updated_at` del record, che è
un'approssimazione. Ogni riga generata porta
`note = 'importo ricostruito dalla migrazione'`, così resta per sempre
distinguibile da un incasso registrato davvero.

**La data di consegna della visita non esiste**, c'è solo il booleano
`visita_sportiva`. Per questo lo stato della visita si calcola dalla scadenza
(§3): i record storici con scadenza nota funzionano, e quelli con
`visita_sportiva = true` senza scadenza finiscono nel report come anomalie da
sistemare a mano, non riempiti con una data inventata.

**Righe orfane.** Presenze con `squadra_id` nullo non possono diventare una seduta;
squadre con `stagione_id` nullo non appartengono a nessuna stagione. Lo script non
prova a ripararle: le elenca nel report con id e chiave, e si decide caso per caso.
Le migration `033_fix_presenze_organization_id` e `034_fix_partite_organization_id`
suggeriscono che ce ne siano.

Il report finale è un file: righe migrate per tabella, scartate con motivo, anomalie
con id. Si legge prima di dare l'ok.

## 10. Cutover

```
1. Migrazione dry-run sul nuovo progetto -> si legge il report
2. Correzione delle anomalie nel vecchio DB, o accettazione esplicita
3. UAT sui dati reali migrati: un dirigente e un allenatore veri, sui loro dati
4. Freeze del vecchio sistema + avviso agli utenti
5. Migrazione finale, switch del dominio
6. Vecchia app in sola lettura per alcune settimane
```

Rollback: progetto Supabase e repo vecchi restano intatti e funzionanti, si ripunta
il dominio. È la ragione per cui si è scelto un progetto nuovo invece della
riscrittura in-place.

**Momento del cutover.** La stagione 2026-27 comincia a settembre 2026: il cutover
naturale è prima dell'inizio. Si migrano le stagioni concluse come storico e la
2026-27 nasce direttamente nel sistema nuovo, senza spostare a metà anno presenze e
pagamenti in corso.

## 11. Ordine di costruzione

La fase 1 è coerente ma ampia: il piano di implementazione la articola in traguardi
verificabili, ciascuno con i propri test, in questo ordine di dipendenza.

```
A. Fondamenta        scaffold Next 15, env.ts, ESLint (incluso il divieto di
                     importare admin.ts da app/), CI, Supabase locale
B. Schema            baseline SQL completo, enum, view, funzioni app.*, RLS,
                     tipi generati. Test su vincoli, view e matrice RLS
C. Auth e shell      login, sessione, richiediRuolo, layout (app), selettore
                     stagione, redirect a stagione corrente, admin/stagioni
D. Anagrafica        persone: elenco, creazione, scheda, storico
E. Squadre e rose    squadre per stagione, tesseramenti, incarichi staff,
                     assegnazioni, numero maglia
F. Quote e visita    quote_importi, registrazione pagamenti, stato da v_quote,
                     date visita, cruscotto scadenze
G. Presenze          sedute, foglio presenze con salvataggio ottimistico
H. Statistiche       v_presenze, pagina statistiche, export
I. Sito pubblico     4 pagine statiche ricostruite
J. Migrazione        scripts/migra.ts, dry-run, report anomalie
K. Cutover           UAT, migrazione finale, switch dominio
```

I traguardi da B a H dipendono ciascuno dal precedente per lo schema, ma D–H sono
verticali indipendenti fra loro: ognuno tocca tabelle proprie e può essere costruito
e collaudato senza attendere gli altri. J dipende solo da B.
