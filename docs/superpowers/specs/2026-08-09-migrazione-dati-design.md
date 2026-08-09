# Migrazione dei dati dal sistema vecchio — Design

Fase 6 del progetto di riscrittura, primo dei due traguardi: lo **script di
migrazione con dry-run e report anomalie** (traguardo J del design generale).
Il cutover vero — UAT, freeze, migrazione finale sul progetto di produzione
nuovo, switch del dominio (traguardo K) — è fuori da questo perimetro e si fa
dopo la fase 5 (sito pubblico), così il dominio nuovo serve anche le pagine
pubbliche dal giorno uno.

Questo documento raffina la sezione §9 del design generale
(`2026-07-29-gestionale-sportivo-rewrite-design.md`) con le decisioni prese
in brainstorming; dove i due divergono, vale questo.

## Decisioni prese

- **Perimetro: solo script + dry-run.** La migrazione reale scrive, per ora,
  soltanto nel database locale di sviluppo. Il progetto Supabase di produzione
  nuovo non esiste ancora e non è compito di questo lavoro crearlo.
- **Accesso ai dati vecchi: lettura diretta dal progetto hosted**
  (`ctrsnztrfslewkpbfxei.supabase.co`) con la service role del sistema vecchio,
  in sola lettura. Le credenziali stanno in `.env.local` (mai committate);
  `.env.example` documenta i nomi. La chiave si recupera dal file
  `.env.local.example` del vecchio repo — che le contiene davvero, uno dei
  motivi per cui esiste la riscrittura.
- **Account staff: si creano, con lo schema della società.** Password
  `passwordIniziale(nome)`, la stessa convenzione della creazione dal
  backoffice. Il report elenca gli account creati; le password si comunicano
  a voce.
- **La data di nascita diventa facoltativa** (decisione del committente,
  2026-08-09). Il primo dry-run sui dati veri ha mostrato che tutti i 188
  tesserati del vecchio sistema hanno `data_nascita` e `codice_fiscale`
  nulli: con `persone.data_nascita NOT NULL` migrerebbe solo lo scheletro.
  Il vincolo cade dal baseline (non ancora deployato, si corregge in place),
  il campo diventa facoltativo anche nel form dell'anagrafica, e un
  tesserato senza data migra con il campo vuoto — da completare col tempo
  dal backoffice. Il codice fiscale era già facoltativo ovunque.
- **Approccio: supabase-js su entrambi i lati.** Lettura dal vecchio con
  service role via PostgREST, scrittura nel nuovo col client admin già
  esistente in `scripts/`. Gli account passano comunque da
  `auth.admin.createUser`, quindi il client c'è già e non si mischiano due
  meccanismi. Niente transazione unica sul target: compensa l'idempotenza
  (sotto). I volumi sono da società giovanile — centinaia di righe, migliaia
  per le presenze — e la paginazione PostgREST in lettura basta.

## Architettura

`scripts/migra.ts`, TypeScript, eseguito a mano da terminale come
`seed-dev.ts`. **Dry-run per default**: legge, trasforma, scrive il report,
non tocca il database. Scrive solo con `--esegui`.

Le quote per stagione non esistono nello storico (il vecchio schema ha solo
`stato_pagamento`, senza cifre): arrivano da riga di comando,
`--quota 2024-25=350 --quota 2025-26=380`. Se nei dati c'è una stagione senza
quota corrispondente, lo script si ferma prima di partire: meglio nessun
versamento che un versamento con l'importo di un'altra stagione.

Flusso: lettura completa e paginata delle tabelle interessate →
trasformazione in memoria → report su file (sempre) → con `--esegui`,
scritture in ordine di dipendenza:

```
stagioni → quote_importi → persone → auth.users + profili → squadre
         → tesseramenti → pagamenti_quota → sedute_allenamento → presenze
```

La visita non è una tabella: nel nuovo schema è il campo `visita_scadenza`
di `tesseramenti`, e viaggia con la riga del tesseramento.

Le trasformazioni vivono in un modulo separato di funzioni pure
(`scripts/migrazione/trasforma.ts`); `migra.ts` orchestra I/O e report. La
separazione esiste per i test: le regole si provano senza database.

### Idempotenza: salta, non sovrascrive

Rieseguire lo script non duplica e non cancella correzioni fatte a mano nel
sistema nuovo. Ogni entità ha una chiave naturale; se la chiave esiste già
nel target, la riga si conta come «già presente» e si salta:

| Entità | Chiave naturale |
|---|---|
| persone | codice fiscale (in mancanza: cognome + nome + data di nascita) |
| account (auth.users + profili) | email |
| stagioni | codice (`2024-25`) |
| squadre | stagione + nome |
| tesseramenti | stagione + persona |
| sedute_allenamento | squadra + data |
| presenze | seduta + tesseramento |
| quote_importi | stagione |
| pagamenti_quota | tesseramento (si migrano solo se il tesseramento è nuovo) |

Il secondo run su un target già migrato deve produrre zero scritture e un
report tutto «già presente»: è anche il test di integrazione dello script.

### Run interrotto: si riparte da zero, non si riesegue sopra

L'idempotenza per chiavi naturali copre i run completati, non quelli
interrotti a metà. Due passaggi non hanno una chiave naturale propria e si
appoggiano a un'altra tabella come proxy: i pagamenti si generano solo per i
tesseramenti creati nello stesso run (un tesseramento già presente non ne
genera uno nuovo, anche se il run precedente si è fermato prima di scrivere il
suo pagamento), e le presenze si considerano già migrate dalla sola presenza
della seduta (una seduta creata ma con le sue presenze non ancora scritte, a
un run successivo, appare già fatta). Un secondo `--esegui` sopra un run
interrotto salterebbe quei dati in modo permanente, con un report che dice
tutto «già presente» mentre non è vero. Per questo un run interrotto NON si
riprende rieseguendo sopra: si azzera il target — `npm run db:reset` in
locale, un progetto appena creato al cutover — e si riesegue da zero.

## Mapping

Dal design generale §9, verificato contro lo schema vecchio reale
(47 migration in `~/Progetti/virpolcampogalliano/supabase/migrations`):

- `tesserati` → `persone`, tutte con `attiva = true`: il vecchio schema non
  ha uno stato sull'anagrafica (l'archiviazione soft è un concetto del
  sistema nuovo), quindi non c'è nulla da mappare.
- `users` staff → `auth.users` + `profili`. Ruoli: se `roles` (array) è
  popolato si prende il più alto per privilegio, altrimenti `role`;
  `admin` → `admin`, `dirigente` → `dirigente`, `allenatore` e
  `vice_allenatore` → `allenatore`. `tesserato` e `genitore` scartati, nessun
  account. Email: quella del vecchio sistema.
  **La persona si collega solo se esiste**: un utente staff che corrisponde a
  un tesserato migrato (stessa terna cognome+nome, senza data di nascita nel
  vecchio `users` il codice fiscale non c'è — il confronto è su
  cognome+nome normalizzati) riusa quella persona. Admin e dirigente senza
  corrispondenza nascono con profilo senza persona, com'è normale nel
  backoffice nuovo. Un **allenatore senza corrispondenza è un'anomalia**:
  il vincolo `profili_allenatore_ha_persona` esige la persona, e creare una
  persona-fantasma con la sola coppia cognome+nome sarebbe inventare
  un'anagrafica che non esiste. Nessun account creato; si sistema a mano
  dal backoffice dopo la migrazione. Due persone migrate con lo stesso
  cognome+nome rendono la corrispondenza ambigua: nessun collegamento
  silenzioso, l'allenatore finisce nella stessa anomalia.
- `stagioni_sportive` → `stagioni`. Nome `'2024/2025'` → codice `'2024-25'`
  più etichetta; `archiviata` → stato `chiusa`, altrimenti `aperta`.
- `squadre` → `squadre`, per stagione.
- `tesserati_squadre_stagioni` fusi con `tesserati_dati_stagionali` sulla
  stessa riga → `tesseramenti` (incluso `numero_maglia`). Il vecchio schema
  ammette lo stesso tesserato in più squadre nella stessa stagione; il nuovo
  ha `unique (persona_id, stagione_id)`: più righe per la stessa coppia →
  **anomalia**, nessun tesseramento migrato per quella coppia, si decide a
  mano. Dati stagionali senza riga squadra → tesseramento senza squadra
  (ammesso dal nuovo schema).
- `presenze` di tipo allenamento, raggruppate per (squadra, data) → una
  `seduta_allenamento` con le sue `presenze`; il booleano `presente` →
  `presente` | `assente`.
- Quote: la quota da CLI diventa una riga di `quote_importi` per stagione;
  `stato_pagamento` → righe di `pagamenti_quota` ricostruite. `pagato` → un
  pagamento pari all'intera quota; `parziale` → metà quota; `non_pagato` e
  `in_sospeso` → nessun pagamento. Data: `updated_at` del record vecchio
  (un'approssimazione dichiarata). Ogni riga generata porta
  `note = 'importo ricostruito dalla migrazione'`, per restare per sempre
  distinguibile da un incasso registrato davvero.
- Visita: `scadenza_certificato` → `tesseramenti.visita_scadenza`;
  `visita_sportiva = true` con `scadenza_certificato` nullo → anomalia nel
  report, nessuna data inventata.
- **Scartati e contati nel report**: magazzino, eventi, economia, tornei,
  avversari, partite, campi, convocazioni, `report_*`, presenze di tipo
  diverso da allenamento.

## Report e anomalie

Un file markdown per esecuzione, `scripts/report-migrazione.md`, sovrascritto
a ogni run, in tre parti:

1. **Conteggi per tabella**: lette, migrate, già presenti (saltate), scartate
   con motivo.
2. **Anomalie**, ciascuna con id e chiave naturale, da decidere caso per caso
   nel vecchio sistema — lo script non ripara mai: presenze con squadra
   nulla, squadre senza stagione, visite `true` senza scadenza, email
   duplicate fra staff, terne cognome+nome+nascita duplicate fra tesserati
   senza codice fiscale, tesserati in più squadre nella stessa stagione,
   allenatori staff senza persona corrispondente in anagrafica.
3. **Account creati** (solo con `--esegui`): email e password iniziale, da
   comunicare a voce.

Il report esce anche in dry-run — è il punto del dry-run. Exit code 0 se lo
script arriva in fondo, anomalie incluse: la decisione di procedere è umana e
si prende leggendo il report, non da un exit code.

## Test

- **Unit sulle trasformazioni pure**: mappatura del nome stagione, fusione
  dei dati stagionali nel tesseramento, raggruppamento presenze → sedute,
  ricostruzione dei versamenti dalla quota, classificazione delle anomalie.
  I casi si arricchiscono con quelli veri trovati dal primo dry-run, inclusi
  gli sporchi (orfani, duplicati).
- **Integrazione**: il dry-run contro i dati reali, letto da un umano; la
  riesecuzione su target già migrato che produce zero scritture.
- Nessun E2E: lo script non ha UI.

L'I/O (lettura paginata, scritture, auth admin) resta sottile e non testato
in automatico.

## Sicurezza

Le due service role (vecchia e nuova) vivono solo in `scripts/`, dentro il
recinto ESLint già esistente. Le variabili del vecchio progetto
(`VECCHIO_SUPABASE_URL`, `VECCHIO_SERVICE_ROLE_KEY`) seguono la stessa strada
di quelle esistenti: `.env.local` per i valori, `.env.example` per i nomi.
Lo script non tocca mai il vecchio database in scrittura: nessuna chiamata
che non sia `select` verso il lato vecchio.

## Fuori perimetro (traguardo K, dopo la fase 5)

UAT sui dati reali migrati con un dirigente e un allenatore veri; correzione
delle anomalie nel vecchio DB o loro accettazione esplicita; freeze del
vecchio sistema; creazione del progetto Supabase di produzione nuovo;
migrazione finale; switch del dominio; vecchia app in sola lettura per
alcune settimane. Rollback: il progetto e il repo vecchi restano intatti, si
ripunta il dominio.
