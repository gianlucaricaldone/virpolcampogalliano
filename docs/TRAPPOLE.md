# Trappole già pagate

Sei modi di fallire incontrati costruendo la fase 1. Hanno una cosa in comune, ed
è la ragione per cui vale la pena leggerli prima di scrivere una migration o un
test: **producono verde**. Nessuno faceva fallire una suite. Quattro hanno
superato una review prima di essere trovati.

L'evidenza completa di ognuno è nel ledger, in
`~/Progetti/virpolcampogalliano/.superpowers/sdd/2026-07-29-fondamenta-schema-auth/progress.md`.

---

## 1. Le RLS non hanno un verbo per TRUNCATE

**Cosa succedeva.** `pg_default_acl` del ruolo `postgres` concede
`TRUNCATE, REFERENCES, TRIGGER, MAINTAIN` ad `anon` e `authenticated` su ogni
tabella creata da una migration, automaticamente, senza che nessuno lo scriva. Le
RLS hanno verbi per select, insert, update e delete: per TRUNCATE nessuna policy
può filtrarlo.

Risultato: la chiave anon — che viaggia nel bundle del browser — non poteva
leggere l'indirizzo di un tesserato minorenne, ma poteva **cancellare l'intera
anagrafica** e il registro dei pagamenti. Dimostrato svuotando otto tabelle come
`anon` dentro una transazione annullata.

**Come è chiuso.** Revoke esplicita sulle dieci tabelle **e sulle due view** — che
per GRANT e REVOKE contano come tabelle — più `alter default privileges`, perché
le migration future ereditino la restrizione invece di dipendere dalla memoria di
qualcuno.

**Cosa portarne via.** Le RLS proteggono le righe. I privilegi di tabella sono uno
strato separato e sotto, e non li scrivi tu. Il test che lo presidia asserisce
l'**insieme esatto** dei privilegi di un ruolo su tutto lo schema, non che una
lettura fallisca: è la differenza fra verificare una proprietà e descrivere lo
stato attuale.

---

## 2. `ON DELETE SET NULL` su chiave multi-colonna azzera tutte le colonne

**Cosa succedeva.** `tesseramenti` ha una FK composita `(squadra_id, stagione_id)`
con `ON DELETE SET NULL`. Postgres azzera **tutte** le colonne locali della
chiave, non quella che ti interessa — quindi cancellare una squadra provava ad
azzerare anche `stagione_id`, che è `NOT NULL`, e l'intera cancellazione abortiva.

Latente attraverso due task con suite verdi e review approvate, perché nessun test
aveva mai cancellato una squadra con un tesseramento attaccato.

**Come è chiuso.** La sintassi con lista di colonne, `ON DELETE SET NULL
(squadra_id)`, disponibile da Postgres 15.

**Cosa portarne via.** Il test che copre quel percorso asseriva solo che
`squadra_id` diventasse nulla. Un fix che azzerasse *entrambe* le colonne
l'avrebbe passato. Ora asserisce anche che `stagione_id` **sopravviva**: quando
verifichi un `SET NULL`, verifica anche cosa non deve cambiare.

---

## 3. Un vincolo differito non viene verificato in una transazione annullata

**Cosa succedeva.** `presenze_tesseramento_di_squadra` è
`DEFERRABLE INITIALLY DEFERRED`, perché una `delete from squadre` innesca più
percorsi di cascade il cui stato *intermedio* è incoerente mentre quello finale
non lo è.

Conseguenza non ovvia: un check differito viene eseguito al commit. Tutti i test
del database girano dentro `inRollback`, che non committa mai. Quindi ogni test
che verificava una violazione di quel vincolo **diventava verde senza verificare
nulla** — e il segnale era identico a quello del successo.

**Come è chiuso.** I test che devono osservare quella violazione dichiarano
`set constraints ... immediate` come prima istruzione della transazione. Il test
sul cascade fa il contrario: `set constraints all immediate` **dopo** la delete,
per provare che la transazione potrebbe chiudersi e non solo che l'istruzione è
riuscita.

**Cosa portarne via.** È capitato due volte nello stesso task: la seconda non
l'avevo prevista. Se rendi differito un vincolo, cerca ogni test che dipende dal
suo rifiuto.

---

## 4. `MATCH SIMPLE`: una colonna nulla soddisfa una FK composita a vuoto

**Cosa succedeva.** `presenze` porta `squadra_id` denormalizzata più due FK
composite, verso la seduta e verso il tesseramento: è ciò che impedisce di
registrare un giocatore su una seduta di un'altra squadra.

Con la semantica `MATCH SIMPLE`, che è il **default** di Postgres, una FK
composita con una qualsiasi colonna nulla è soddisfatta senza controllare niente.
Una `squadra_id` nullable avrebbe annullato in silenzio l'intera garanzia mentre il
vincolo sembrava esserci.

**Come è chiuso.** `squadra_id NOT NULL`, con il perché scritto nel commento.

**Cosa portarne via.** Su una FK composita il `NOT NULL` non è igiene, è parte del
vincolo.

---

## 5. L'ordine dei trigger di integrità referenziale non è garantito

**Cosa succedeva.** Con più percorsi di cascade sulla stessa cancellazione, il
`SET NULL` su `tesseramenti` scattava **prima** del `CASCADE` su `sedute`, quando
le presenze puntavano ancora alla vecchia squadra — e il vincolo rifiutava.

La proposta iniziale era droppare e ricreare il vincolo per fargli ottenere un OID
più alto e cambiare l'ordine. È stata **rifiutata**: Postgres esegue i trigger
dello stesso evento in ordine **alfabetico dei nomi**, e i nomi dei trigger RI
contengono l'oid — quindi l'ordine coincide con quello di creazione solo finché
gli oid hanno la stessa ampiezza in cifre. Né `pg_dump` né uno squash di migration
promettono di preservarlo, e il restore è il percorso di disaster recovery.

**Come è chiuso.** Differendo il vincolo, che rende la garanzia indipendente
dall'ordine. Nota che Postgres **non differisce le azioni referenziali**, solo il
check `NO ACTION`: il `CASCADE` resta identico.

**Cosa portarne via.** Correttezza che dipende dall'ordine di creazione degli
oggetti è correttezza che evapora al primo restore, e in silenzio.

---

## 6. Escaping SQL dentro stringhe TypeScript

**Cosa succedeva.** Apostrofi raddoppiati (`''`) scritti per riflesso dentro
stringhe TypeScript single-quoted, dove il secondo apice **chiude il literal**. 18
occorrenze fra nomi di test e messaggi utente. Poi la stessa cosa con i backtick
dentro un template literal.

**Cosa portarne via.** Dentro i literal **SQL** — i corpi di `COMMENT ON` — gli
apostrofi raddoppiati sono escaping corretto e vanno lasciati. La distinzione è
fra le due lingue nello stesso file, non fra giusto e sbagliato.

---

## Bonus: due test che passavano per il motivo sbagliato

Non sono trappole di Postgres ma della stessa famiglia, e vale conoscerli.

**`.first()` su una lista con più righe candidate.** Un test chiudeva una stagione
e asseriva che la cella "chiusa" fosse visibile usando `.first()`. Con un'altra
stagione già chiusa in elenco, `.first()` intercettava **quella** riga:
l'assertion passava prima che la stagione giusta fosse chiusa, e il fallimento
compariva in un test **diverso**. Un verde che rompe un altro test è il caso più
difficile da tracciare, perché l'evidenza punta al file sbagliato. Localizza la
riga, non la prima corrispondenza.

**Compensazioni di stato scritte in coda a un test.** Ripristinare lo stato
condiviso dopo le assertion significa non ripristinarlo quando un'assertion
lancia. Va in un hook che gira comunque, con scritture idempotenti su target noti
invece di toggle da uno stato assunto. E la prova che sia a prova di crash non è
che i test passino: è far fallire un'assertion di proposito e verificare che il
ripristino sia avvenuto.
