# Gestione degli utenti applicativi — design

**Data:** 2026-07-30
**Stato:** approvato, da pianificare
**Chiude:** il primo debito noto di `CLAUDE.md` — «nessuna gestione degli utenti
applicativi dal backoffice»

## Il problema

Oggi un mister nuovo non può entrare finché qualcuno non apre lo Studio di
Supabase o lancia `seed:dev` da un computer che ha la chiave service role.
Prima del cutover questo non regge: al primo allenatore che arriva a stagione
iniziata servirebbe un intervento manuale sul database di produzione, fatto da
chi ha in mano una chiave che scavalca ogni policy.

L'obiettivo è una schermata `/admin/utenti` da cui l'admin crea gli account,
assegna i ruoli e disattiva chi se ne va.

## Il vincolo che decide tutto

Creare un utente in `auth.users` richiede la **service role**. Non esiste una
via con la chiave anon:

- `supabase.auth.signUp()` è chiuso da `enable_signup = false` in `[auth]`, ed è
  una protezione voluta e verificata da un test — vedi `docs/TRAPPOLE.md` §8.
- `auth.admin.createUser()` e `inviteUserByEmail()` vogliono entrambi la chiave
  di servizio.

L'applicazione oggi non ha quella chiave: `lib/env.ts` valida tre variabili e
nessuna è il segreto. Una regola ESLint, con fixture sotto test, vieta di
importare `lib/supabase/admin` e `scripts/env` da `app/`, `components/` e
`lib/repos/`.

**Decisione:** la chiave entra nell'ambiente Vercel e viene usata da un solo
file. Le alternative valutate e scartate:

| Approccio | Perché no |
|---|---|
| Edge Function Supabase che tiene la chiave | La blast radius sarebbe minore — il segreto non toccherebbe mai Vercel né il processo Next — ma introduce un secondo artefatto da deployare e versionare, `supabase functions serve` in sviluppo, e un pezzo che l'harness di questo repo non copre. Sproporzionato per il backoffice di una società con tre utenti. |
| Schermata che registra la richiesta, script che la esegue | Manterrebbe l'invariante alla lettera, ma il mister non entrerebbe finché qualcuno non lancia un comando: è esattamente il passaggio manuale da togliere. |

**Costo accettato:** su Vercel esiste una variabile capace di scavalcare ogni
RLS. Il contenimento è che un solo file può leggerla, e che la regola ESLint —
estesa, non allentata — lo dimostra a ogni `npm run lint`.

## Le due metà, e perché sono separate

La schermata fa due cose molto diverse, e vanno tenute su percorsi diversi:

**Leggere** l'elenco degli utenti **non** passa dalla service role. Sarebbe una
pagina che scavalca le RLS per mostrare dati, cioè il contrario di come è
costruito tutto il resto. Il problema è che `auth.users` non è leggibile da
`authenticated` e l'email sta lì.

**Scrivere** su Auth passa dalla service role, perché non c'è altro modo.

### Leggere: una funzione SECURITY DEFINER in `public`

```sql
create or replace function public.elenco_utenti()
returns table (
  id uuid, email text, ruolo public.ruolo_app, attivo boolean,
  persona_id uuid, persona_cognome text, persona_nome text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
```

Dentro, come prima istruzione:

```sql
if app.mio_ruolo() <> 'admin' then
  raise exception 'solo un amministratore può elencare gli utenti'
    using errcode = '42501';
end if;
```

Solleva invece di restituire zero righe: un elenco vuoto non si distingue da
«non ci sono utenti», e un controllo che fallisce in silenzio è un controllo che
prima o poi qualcuno toglie credendolo inutile. Il codice `42501` è già tradotto
da `lib/errors/postgres.ts` in «Operazione non consentita».

**In `public` e non in `app`.** Lo schema `app` non è esposto nell'API, quindi
una funzione lì non è chiamabile da `.rpc()`. Metterla in `public` la rende
raggiungibile, e questo impone una precauzione: **Postgres concede EXECUTE a
PUBLIC per default su ogni funzione nuova**. Senza revoca esplicita, la chiave
anon — che viaggia nel bundle del browser — potrebbe chiamarla. La migration
quindi fa, in quest'ordine:

```sql
revoke execute on function public.elenco_utenti() from public;
grant  execute on function public.elenco_utenti() to authenticated;
```

Un test asserisce che `anon` riceve un errore, non un elenco.

`security definer` con `set search_path = ''` e nomi qualificati: stessa forma
delle funzioni in `app`, e per la stessa ragione — con il search_path vuoto,
nessun chiamante può dirottare `public.profili` su una tabella propria.

### Scrivere: un client di servizio, un file solo

`lib/supabase/servizio.ts` — nuovo, distinto da `lib/supabase/admin.ts`, che
resta agli script. Valida `SUPABASE_SERVICE_ROLE_KEY` con zod e lancia un errore
esplicito se manca: un deploy configurato male deve rompersi al primo uso con un
messaggio leggibile, non restituire 401 opachi.

Importabile solo da `app/(app)/admin/utenti/`. Nella configurazione ESLint:

- `(^|/)supabase/servizio$` si aggiunge ai pattern vietati per `app/**`,
  `components/**`, `lib/repos/**`;
- un blocco successivo, con `files: ['app/(app)/admin/utenti/**/*.ts']`,
  ridichiara la regola **senza** quel pattern.

Le fixture nuove coprono il lato divieto. Il lato permesso è dimostrato dal file
vero: se l'eccezione non funzionasse, `npm run lint` fallirebbe su di lui.

## Flusso di creazione

```
1. l'admin cerca la persona in anagrafica (GET ?q=), la sceglie
2. compila email e ruolo, invia
3. richiediRuolo(db, ['admin'])            client normale, sotto RLS
4. auth.admin.createUser({ email, password, email_confirm: true })
                                            client di servizio
5. insert in profili { id, ruolo, persona_id }
                                            client normale, policy profili_ins
6. se il passo 5 fallisce: deleteUser(id) e propaga l'errore originale
7. la password torna all'interfaccia e viene mostrata una volta
```

**Il passo 6 non è una rifinitura.** Un profilo rifiutato — per esempio un
allenatore senza persona, che `profili_allenatore_ha_persona` respinge —
lascerebbe in `auth.users` un utente che non può entrare ma tiene occupata
l'email. Il secondo tentativo fallirebbe con «email già registrata» e nessuno
capirebbe perché.

`email_confirm: true` perché non c'è SMTP: l'utente non riceverà mai una mail di
conferma, e senza quel flag non potrebbe accedere.

Il passo 5 usa il client normale di proposito: la policy `profili_ins` vale già
per l'admin, e passare dalla service role anche lì significherebbe che una
regressione nelle policy non verrebbe più intercettata da nessun test.

## La password

Schema deciso dal committente: `nome_VIRPOL_1234`, dove `nome` è il nome di
battesimo della persona collegata, normalizzato — minuscolo, senza accenti né
spazi. Marco Rossi diventa `marco_VIRPOL_1234`. Per un admin o un dirigente
senza persona collegata si usa la parte dell'email prima della chiocciola, con
la stessa normalizzazione.

Funzione pura in `lib/domain/password.ts`, con test sui casi che rompono le
normalizzazioni fatte a mano: accenti (`Niccolò`), nomi composti (`Maria
Grazia`), apostrofi (`D'Angelo`).

**Rischio noto e accettato.** Lo schema è indovinabile: chi conosce il nome di
un allenatore e la convenzione della società può entrare al suo posto, e dietro
quel login ci sono anagrafiche di minori con indirizzi e date di visita medica.
L'alternativa proposta — password generata e mostrata una volta sola all'admin,
che la detta a voce esattamente come farebbe con l'altra — è stata scartata dal
committente. Sta qui perché una scelta consapevole va scritta: se un giorno
questa applicazione uscirà dalla singola società, è la prima cosa da cambiare, e
costa la sostituzione di una funzione pura.

## Superficie

**Migration** `supabase/migrations/20260730000100_utenti.sql`
`public.elenco_utenti()`, con revoke e grant. Nessuna tabella nuova: `profili`
c'è già.

**Repository** `lib/repos/utenti.ts`
- `elencaUtenti(db)` — `rpc('elenco_utenti')`
- `aggiornaProfilo(db, id, { ruolo?, personaId?, attivo? })` — **una** UPDATE:
  cambiare ruolo e collegare la persona sono lo stesso gesto quando si promuove
  qualcuno ad allenatore, e in due chiamate la prima passerebbe e la seconda
  verrebbe respinta dal vincolo.

**Client di servizio** `lib/supabase/servizio.ts`

**Rotte** `app/(app)/admin/utenti/page.tsx`, `actions.ts`

**Componenti** `components/utenti/FormNuovoUtente.tsx`, `TabellaUtenti.tsx`

**Dominio** `lib/domain/password.ts`

**Navigazione** voce «Utenti» accanto a «Stagioni», visibile al solo admin.

**Un admin non può disattivare né declassare sé stesso.** Le policy lo
consentirebbero — `profili_upd` guarda il ruolo di chi scrive, non chi subisce —
e in una società con un solo amministratore quel click chiuderebbe fuori tutti,
senza più nessuno in grado di riaprire se non con la chiave di servizio. Il
controllo sta nella Server Action, confrontando l'id con quello della sessione,
e ha un test suo.

Nessuna cancellazione di utenti: si disattiva con `profili.attivo`, coerente con
l'archiviazione dell'anagrafica. `sedute_allenamento.created_by` e
`pagamenti_quota.registrato_da` puntano a `profili`: cancellare un profilo li
azzera e si perde la traccia di chi ha fatto cosa.

## Errori

| Caso | Messaggio |
|---|---|
| Email già in `auth.users` | «Esiste già un utente con questa email» — da riconoscere sull'errore di Auth, non su un vincolo Postgres |
| Allenatore senza persona | già in mappa: `profili_allenatore_ha_persona` |
| Chiamante non admin | `42501`, già tradotto |
| `SUPABASE_SERVICE_ROLE_KEY` mancante | errore esplicito al primo uso |

## Test

**`test:db`** — `elenco_utenti()` risponde all'admin, solleva `42501` per
dirigente e allenatore, e **solleva anche per `anon`**: quest'ultimo è il test
che protegge dalla revoca dimenticata su PUBLIC. `aggiornaProfilo` consentito al
solo admin, negato agli altri dalle policy.

**`test:unit`** — `passwordIniziale` su accenti, nomi composti, apostrofi,
persona assente.

**`test:lint`** — fixture nuove: importare `lib/supabase/servizio` da `app/`,
`components/` e `lib/repos/` deve fallire.

**`test:e2e`** — il giro completo, ed è il test che conta: l'admin crea un
mister, legge la password a schermo, **quel mister accede con quella password** e
vede solo le proprie squadre. Più: un dirigente su `/admin/utenti` viene
rimbalzato, un utente disattivato non entra più, e l'admin non riesce a
disattivare sé stesso.

## Fuori scope

Cambio password da parte dell'utente, recupero password via email, cancellazione
definitiva, elenco degli utenti Auth orfani di profilo (la compensazione al
passo 6 li rende impossibili), audit log dei cambi di ruolo.
