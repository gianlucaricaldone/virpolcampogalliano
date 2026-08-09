# Architettura

Le decisioni strutturali e il perché. Il *cosa* si legge dal codice; qui c'è
quello che il codice non può dire.

Lo spec completo, con le alternative scartate e i loro motivi, è in
`docs/superpowers/specs/2026-07-29-gestionale-sportivo-rewrite-design.md`, qui in
questo repo. I piani di implementazione stanno in `docs/superpowers/plans/`.

## Modello dati

Dieci tabelle, due view. L'idea portante è che **l'anagrafica è permanente e
l'appartenenza è per stagione.**

```
persone            anagrafica, attraversa le stagioni, mai cancellata (attiva bool)
profili            account applicativi, 1:1 con auth.users, ruolo singolo
stagioni           codice '2026-27' = segmento di URL, stato aperta|chiusa
squadre            per stagione
tesseramenti       un giocatore in una squadra, per stagione: maglia, visita medica
incarichi_staff    una riga per incarico: allenatore | vice | dirigente di squadra
quote_importi      tutti gli importi, e solo qui
pagamenti_quota    registro dei versamenti
sedute_allenamento la seduta è un'entità
presenze           una riga per giocatore per seduta
v_quote            stato del pagamento, derivato
v_presenze         statistiche di presenza, derivate
```

### Chiavi esterne composite

`tesseramenti`, `incarichi_staff` e `sedute_allenamento` dichiarano
`FOREIGN KEY (squadra_id, stagione_id) REFERENCES squadre(id, stagione_id)`.
Richiede una `UNIQUE (id, stagione_id)` su `squadre` che sembra ridondante rispetto
alla primary key e non lo è in effetto.

È il vaccino contro il bug che è la ragione per cui questa riscrittura esiste: nel
sistema vecchio una riga di associazione poteva puntare a una squadra di un'altra
stagione e **nulla se ne accorgeva** — i dati derivavano fra stagioni in silenzio.
Qui il database rifiuta la riga.

`presenze` usa la stessa tecnica su un asse diverso: `squadra_id` denormalizzata e
`NOT NULL`, con due FK composite verso la seduta e verso il tesseramento. La stessa
squadra deve comparire da entrambi i lati, quindi un giocatore non può essere
registrato su una seduta altrui. Il `NOT NULL` è portante — vedi trappola 4.

### Perché la seduta è un'entità

Nel sistema vecchio le presenze erano righe piatte per giocatore e data. Tre
conseguenze: "allenamento non ancora compilato" e "tutti assenti" erano
indistinguibili; due sedute nello stesso giorno impossibili; e il denominatore di
ogni percentuale ambiguo. Per questo le sue statistiche non erano attendibili.

Qui la seduta esiste prima delle presenze, e `v_presenze` usa come denominatore
**tutte** le sedute della squadra, comprese quelle senza riga per quel giocatore,
esponendo `non_registrate` accanto alla percentuale. Chi si tessera a gennaio
risulta con percentuale bassa e `non_registrate` alto: è la lettura onesta. Un
denominatore "furbo" che conta solo le sedute in cui il giocatore ha una riga
nasconde le sedute non compilate, che è esattamente il difetto di prima.

### Perché gli importi stanno tutti in una tabella

Requisito di sicurezza, non di modellazione. Le RLS filtrano **righe, non
colonne**: un allenatore può leggere le righe dei tesseramenti della propria
squadra, quindi un importo su quella riga gli sarebbe visibile. E `stagioni` e
`squadre` devono essere leggibili senza login per il sito pubblico, quindi un
importo su una delle due sarebbe raggiungibile con la chiave anon, che è pubblica
per definizione.

Tenere gli importi fuori da ogni tabella leggibile da un allenatore o da un
anonimo è ciò che rende applicabile la regola "l'allenatore non vede le quote".
Le tre `UNIQUE` su `quote_importi` convivono perché due colonne su tre sono nulle
per riga e Postgres considera i NULL distinti — **non** aggiungere
`NULLS NOT DISTINCT` lì (`sedute_allenamento` invece lo usa deliberatamente, dove
due sedute lo stesso giorno senza ora *sono* duplicate).

## Autorizzazione

Tre ruoli: `admin`, `dirigente`, `allenatore`. Nessun account per giocatori o
genitori.

**Due barriere indipendenti**, e la seconda esiste perché la prima è scrivibile a
mano da chiunque:

1. **Privilegi di tabella.** `anon` non ha alcun privilegio sulle tabelle di
   dominio: legge solo `v_squadre_pubbliche` (vedi sotto). `authenticated` ha la
   DML sulle dieci tabelle. `service_role` la DML, senza TRUNCATE. Un
   `using (true)` copiato per errore su `persone` in un task futuro non può
   esporla ad `anon`, perché il privilegio non c'è.
2. **Policy RLS**, 46, separate per verbo.

Perché separate per verbo: una policy `FOR ALL` che porta `stato = 'aperta'` nella
`USING` renderebbe le stagioni chiuse **invisibili** invece che in sola lettura, e
lo storico sparirebbe. Quindi `FOR SELECT` senza condizione di stagione, e
`INSERT/UPDATE/DELETE` con. Ogni policy di scrittura dichiara **sia `USING` sia
`WITH CHECK`** dove il verbo lo permette: `USING` da sola filtra ciò che leggi ma
non valida ciò che scrivi, e un `INSERT` mirato piazzerebbe righe su squadre
altrui.

### Le funzioni helper, e la ricorsione

Quattro funzioni in schema `app`: `mio_ruolo`, `mia_persona`, `mie_squadre`,
`stagione_aperta`. Tutte `SECURITY DEFINER`, quindi leggono `profili` senza
attivarne le RLS — è così che la policy su `profili` non interroga `profili` e non
può ricorrere come nel sistema vecchio, che moriva su
`infinite recursion detected in policy for relation "users"`.

Tutte dichiarano `set search_path = ''` e qualificano ogni nome. Senza il path
vuoto, chi controlla il `search_path` può far risolvere `profili` a una propria
tabella e restituire il ruolo che vuole: un'escalation di privilegio che non
somiglia a niente.

Lo schema `app` **non** è esposto nell'API, quindi nessuna di quelle funzioni è
chiamabile via RPC.

`public.elenco_utenti()` è l'unica funzione `SECURITY DEFINER` esposta
nell'API. Il controllo del ruolo è dentro di lei e usa `is distinct from`:
`app.mio_ruolo()` è NULL senza sessione, e con `<>` il confronto darebbe NULL,
l'IF non scatterebbe e la funzione restituirebbe l'elenco intero. La revoca
dell'EXECUTE che Postgres concede a PUBLIC è ciò che tiene fuori `anon`, e ha
un test suo.

### `v_squadre_pubbliche`, l'eccezione security_invoker

È l'unica view del repository senza `security_invoker`: esiste perché `anon`
non ha più alcun privilegio sulle tabelle di dominio, e senza una view di
proprietà di `postgres` — che legge `stagioni` e `squadre` coi diritti del
proprietario, ignorando le RLS del chiamante — il sito pubblico non avrebbe
modo di mostrare nome, categoria e annata delle squadre della stagione in
corso. Il recinto non sta nelle policy RLS di `stagioni` e `squadre`, che
`anon` non arriva nemmeno ad attraversare: sta nella definizione della view
stessa, tre sole colonne e solo le righe della stagione corrente — la stessa
regola di `stagioneCorrenteDa` in `lib/domain/stagione.ts`, duplicata qui
perché una view non può chiamare TypeScript. La migration che la introduce
revoca il `grant select` diretto che il baseline delle RLS aveva concesso ad
`anon` su `stagioni` e `squadre` per questo stesso scopo: da quel momento
`anon` legge solo attraverso la view, mai le tabelle sottostanti. La matrice
RLS verifica entrambi i lati del recinto: che `anon` legga la view e che non
possa più leggere le tabelle.

### Il limite noto delle view

Le quattro view — `v_quote`, `v_visite`, `v_presenze`, `v_presenze_squadra` —
sono `security_invoker = true`, quindi le RLS delle tabelle sottostanti valgono
per il chiamante.

Su `v_quote` questo ha una conseguenza: un allenatore non ha policy sulle due
tabelle finanziarie, quindi legge zeri e `stato = 'saldato'` — dati fuorvianti,
non un leak. Non è correggibile dentro la view: non si può distinguere "nessun
override configurato" da "non visibile a me". La guardia è a monte, e non
consiste nel filtrare le righe dopo averle chieste: **le pagine finanziarie non
chiedono affatto il dato** a chi non può vederlo. `/[stagione]/quote` rimanda
indietro l'allenatore, la scheda del tesserato non interroga `v_quote` per lui,
e `scadenzeStagione` restituisce `null` — non un elenco vuoto — quando le quote
non sono state richieste, così la pagina non scrive "nessuna quota aperta" a chi
semplicemente non le vede. Un test asserisce comunque il comportamento a zeri,
perché è ciò che accadrebbe se una pagina futura dimenticasse la guardia.

È anche il motivo per cui lo stato della visita medica sta in una view sua e non
in una colonna di `v_quote`: appoggiandosi alle tabelle finanziarie, un
allenatore smetterebbe di vedere le visite dei propri giocatori — cioè il dato
che gli dice chi può scendere in campo.

## Applicazione

**Si legge nei Server Component, si scrive nelle Server Action.** Il browser non
interroga Supabase per dati di dominio; il client browser esiste ma nessuno lo
importa.

**La stagione vive nell'URL** (`/2026-27/squadre`). Il link è condivisibile e non
ambiguo, i Server Component la leggono dal parametro di rotta senza stato client,
e non serve nessun context globale. Il vincolo `codice ~ '^\d{4}-\d{2}$'` nel
database è ciò che rende sicuro mettere `[stagione]` accanto ai segmenti statici
`anagrafica` e `admin`: la collisione è impossibile per costruzione, non per
convenzione.

Il punto di ingresso del backoffice è `(app)/gestione/page.tsx`, **non**
`(app)/page.tsx`: `(app)` e `(public)` sono route group, quindi una pagina alla
radice di entrambi risolverebbe a `/` e Next rifiuta due pagine parallele sullo
stesso percorso.

**Il middleware fa una cosa sola**: rinfresca il cookie di sessione e reindirizza
al login chi non è autenticato. Nessun controllo di ruolo — il sistema vecchio ne
aveva uno su un matcher che puntava ai percorsi sbagliati, quindi non scattava mai
e nulla lo segnalava. I ruoli si verificano nelle Server Action e nelle RLS.

**I repository ricevono il client come primo argomento.** Non è stile: è ciò che
permette di eseguire la stessa funzione come tre ruoli diversi nei test, ed è il
modo in cui si verifica che un allenatore non legga le quote passando dal
repository. `tests/db/harness-repo.ts` è ciò che rende usabile quella capacità:
crea utenti Auth veri, li autentica con `signInWithPassword` e pulisce per id
tracciati.

**Le Server Action restituiscono `Risultato<T>`.** I fallimenti previsti diventano
valori, i bug veri propagano a `error.tsx`. La distinzione conta: un bug che
arriva travestito da errore di validazione si sistema nel messaggio invece che
nella causa. Il caso emblematico è il login, che convertiva *ogni* errore di
`signInWithPassword` in "email o password non corretti" — rate limit, outage,
progetto malconfigurato — quindi si passava un pomeriggio sul sintomo sbagliato.
Ora solo `invalid_credentials` diventa quel messaggio.

## Migration

Sette file, un baseline unico. Il sistema vecchio ne aveva 47 con nove numeri
duplicati, cioè un ordine di applicazione ambiguo e uno schema non riproducibile.

Finché il baseline non è deployato le correzioni si fanno **in place**: una
migration di rattoppo su una migration mai deployata è il primo passo verso quelle
47. Dopo il deploy diventano immutabili.
