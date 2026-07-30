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

1. **Privilegi di tabella.** `anon` ha `SELECT` su `stagioni` e `squadre` e nulla
   più. `authenticated` ha la DML sulle dieci tabelle. `service_role` la DML, senza
   TRUNCATE. Un `using (true)` copiato per errore su `persone` in un task futuro
   non può esporla ad `anon`, perché il privilegio non c'è.
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

### Il limite noto delle view

`v_quote` e `v_presenze` sono `security_invoker = true`, quindi le RLS delle
tabelle sottostanti valgono per il chiamante. Un allenatore non ha policy sulle due
tabelle finanziarie, quindi legge zeri e `stato = 'saldato'` — dati fuorvianti, non
un leak. Non è correggibile: non si può distinguere "nessun override configurato"
da "non visibile a me". La guardia vera è il layer dei repository, che rifiuta la
chiamata per i ruoli non autorizzati, e un test asserisce esplicitamente il
comportamento a zeri.

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
permette di eseguire la stessa funzione come tre ruoli diversi nei test. Vedi il
debito noto in `CLAUDE.md` — oggi quella capacità non è ancora sfruttata.

**Le Server Action restituiscono `Risultato<T>`.** I fallimenti previsti diventano
valori, i bug veri propagano a `error.tsx`. La distinzione conta: un bug che
arriva travestito da errore di validazione si sistema nel messaggio invece che
nella causa. Il caso emblematico è il login, che convertiva *ogni* errore di
`signInWithPassword` in "email o password non corretti" — rate limit, outage,
progetto malconfigurato — quindi si passava un pomeriggio sul sintomo sbagliato.
Ora solo `invalid_credentials` diventa quel messaggio.

## Migration

Sei file, un baseline unico. Il sistema vecchio ne aveva 47 con nove numeri
duplicati, cioè un ordine di applicazione ambiguo e uno schema non riproducibile.

Finché il baseline non è deployato le correzioni si fanno **in place**: una
migration di rattoppo su una migration mai deployata è il primo passo verso quelle
47. Dopo il deploy diventano immutabili.
