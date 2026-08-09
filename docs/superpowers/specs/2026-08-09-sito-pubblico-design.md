# Sito pubblico — Design

Fase 5 della riscrittura, traguardo I del design generale: le quattro pagine
pubbliche — home, squadre, contatti, dove siamo — con **lo stesso contenuto e
la stessa impostazione visiva di oggi**, ricostruite come Server Component.
Il ridisegno grafico è esplicitamente rinviato a una fase successiva con spec
propria (design generale, «Fuori perimetro»). È l'ultima fase prima del
cutover: senza di lei, lo switch del dominio spegnerebbe le pagine pubbliche.

## Decisioni prese

- **Le squadre vengono dal database** (decisione del committente, 2026-08-09).
  Il sito vecchio ha l'elenco hardcoded in un array dentro la pagina: mentiva
  a ogni cambio di stagione. La pagina nuova legge le squadre della stagione
  corrente — nomi e categorie sono già migrati — e si aggiorna da sola.
- **L'accesso anonimo passa da una view dedicata**, non da policy sulle
  tabelle né dalla service role. `public.v_squadre_pubbliche` espone solo
  `nome`, `categoria` e `annata` delle squadre della stagione corrente; il
  `grant select` ad `anon` (e `authenticated`) sta sulla sola view, le
  tabelle restano chiuse. Le RLS sono per riga, non per colonna: una policy
  `anon` su `squadre` esporterebbe anche `note`, che è interno. La regola
  «quale stagione è corrente» vive nello SQL della view — la prima con
  `stato = 'aperta'` per `data_inizio desc`, la stessa di
  `stagioneCorrenteDa` — perché le regole di business non si duplicano in
  TypeScript.
  Il baseline delle RLS concedeva ad `anon` la SELECT diretta su `stagioni`
  e `squadre` in vista di questa stessa fase, con un commento a due barriere.
  Questa fase l'ha chiusa correggendo il baseline **in place** — non ancora
  deployato, quindi correggibile per regola di CLAUDE.md — invece di
  patcharlo con una revoke qui: l'unico varco per `anon` è, ed è sempre
  stato dichiarato essere, questa view.
- **Il resto è statico.** Home, contatti e dove siamo non leggono nulla:
  contenuti ricopiati dal sito vecchio (testi, sezioni, recapiti, mappa),
  asset copiati da `public/` del vecchio repo. La home passa da 791 righe
  client a un Server Component nell'ordine delle ~80: le animazioni da
  landing page anni-gradient non si portano dietro, l'impostazione visiva
  (hero, «I nostri numeri», chi siamo) sì. Gli anchor link (`#chi-siamo`)
  funzionano nativamente senza JavaScript.

## Architettura

Tutto dentro il gruppo di rotta `(public)`, che già esiste con la sola
`page.tsx` segnaposto:

```
app/(public)/
  layout.tsx         header pubblico (logo, nav alle 4 pagine, link Accedi)
                     + footer (recapiti, social) — solo qui, non nel backoffice
  page.tsx           home: hero, numeri, chi siamo
  squadre/page.tsx   elenco dalla view, raggruppato per categoria,
                     `export const revalidate = 3600`
  contatti/page.tsx  statica
  dove-siamo/page.tsx statica (indirizzo, mappa)
```

La migration `20260809000100_sito_pubblico.sql` crea la view e i suoi grant.
È un oggetto nuovo: migration nuova, come per `elenco_utenti()`, non un
ritocco al baseline.

Tutte le view del repo sono `security_invoker = true`: le RLS delle tabelle
valgono per il chiamante. `v_squadre_pubbliche` è **l'unica senza**, ed è il
punto: deve servire `anon`, che sulle tabelle non ha alcun diritto. Come view
di proprietà di `postgres` legge `stagioni` e `squadre` coi diritti del
proprietario; il recinto sta nella definizione — solo stagione corrente, solo
tre colonne — e nel grant. L'eccezione va dichiarata nel commento SQL della
view, e il test db la tiene: `anon` legge la view ma continua a non leggere
le tabelle.

## Test

| Livello | Cosa prova |
|---|---|
| db | la view espone le squadre della sola stagione corrente e solo le tre colonne; `anon` la legge; `anon` continua a NON leggere `squadre` e `stagioni` direttamente |
| e2e | le 4 pagine rispondono 200 senza sessione; la pagina squadre elenca le squadre del seed; il link Accedi porta al login; le rotte del backoffice restano protette |

Nessun test unit nuovo: non c'è logica TypeScript, solo composizione.

## Fuori perimetro

Ridisegno grafico; tornei (pagina del sito vecchio, rinviata dal design
generale); qualunque contenuto amministrabile da backoffice (i testi si
cambiano nel repo); cutover e switch del dominio (traguardo K, subito dopo
questa fase).
