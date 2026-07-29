create type public.stato_presenza as enum
  ('presente', 'assente', 'giustificato', 'infortunato');

create table public.sedute_allenamento (
  id          uuid primary key default gen_random_uuid(),
  squadra_id  uuid not null,
  stagione_id uuid not null,
  data        date not null,
  ora_inizio  time,
  note        text,
  created_by  uuid references public.profili (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- NULLS NOT DISTINCT richiede Postgres 15: senza, due sedute nello stesso
  -- giorno con ora nulla sarebbero ammesse come righe distinte.
  constraint sedute_squadra_data_ora_key
    unique nulls not distinct (squadra_id, data, ora_inizio),
  constraint sedute_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete cascade,
  -- Appoggio per la FK composita di `presenze`: ridondante rispetto alla
  -- primary key, necessaria perché Postgres pretende una UNIQUE su
  -- esattamente le colonne referenziate.
  unique (id, squadra_id)
);

-- Stesso appoggio su tesseramenti, creata nella migration precedente.
-- Sta qui perché serve solo da questa migration in avanti.
alter table public.tesseramenti add constraint tesseramenti_id_squadra_key
  unique (id, squadra_id);

comment on table public.sedute_allenamento is
  'La seduta è un''entità: distingue "allenamento non compilato" da "tutti '
  'assenti" e dà un denominatore definito alle percentuali di presenza.';

create index sedute_squadra_data_idx on public.sedute_allenamento (squadra_id, data desc);

create table public.presenze (
  id              uuid primary key default gen_random_uuid(),
  seduta_id       uuid not null,
  tesseramento_id uuid not null,
  -- Denormalizzata e NOT NULL. Con le due FK composite sotto, è ciò che
  -- impedisce di registrare un giocatore su una seduta di un'altra squadra:
  -- la stessa squadra deve comparire da entrambi i lati. NOT NULL è
  -- obbligatorio, perché con la semantica MATCH SIMPLE una colonna nulla
  -- soddisfa una FK composita a vuoto e la garanzia svanisce.
  squadra_id      uuid not null,
  stato           public.stato_presenza not null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (seduta_id, tesseramento_id),
  constraint presenze_seduta_di_squadra
    foreign key (seduta_id, squadra_id)
    references public.sedute_allenamento (id, squadra_id) on delete cascade,
  -- Differito: una `delete from squadre` innesca più percorsi di cascade
  -- (sedute e presenze via cascade, tesseramenti.squadra_id via set null) e
  -- Postgres li esegue in ordine di creazione dei trigger. Lo stato finale è
  -- coerente, quello intermedio no. Verificare a fine transazione invece che
  -- per istruzione rende la garanzia indipendente da quell'ordine, che nessun
  -- dump o squash di migration promette di preservare. Cambia QUANDO una
  -- violazione viene segnalata, non SE.
  constraint presenze_tesseramento_di_squadra
    foreign key (tesseramento_id, squadra_id)
    references public.tesseramenti (id, squadra_id) on delete cascade
    deferrable initially deferred
);

comment on constraint presenze_tesseramento_di_squadra on public.presenze is
  'Spostare un tesseramento in un''altra squadra viene rifiutato finché '
  'esistono presenze: quelle presenze appartengono alla squadra in cui sono '
  'state registrate. Per spostare il giocatore si cancellano prima.';

create index presenze_tesseramento_idx on public.presenze (tesseramento_id);

create trigger sedute_updated_at before update on public.sedute_allenamento
  for each row execute function public.tocca_updated_at();
create trigger presenze_updated_at before update on public.presenze
  for each row execute function public.tocca_updated_at();

-- Statistiche di presenza. Unica implementazione della regola.
create view public.v_presenze with (security_invoker = true) as
with sedute_per_squadra as (
  select squadra_id, count(*)::int as sedute
  from public.sedute_allenamento
  group by squadra_id
)
select
  t.id as tesseramento_id,
  coalesce(sps.sedute, 0) as sedute_squadra,
  count(p.id) filter (where p.stato = 'presente')::int     as presenti,
  count(p.id) filter (where p.stato = 'assente')::int      as assenti,
  count(p.id) filter (where p.stato = 'giustificato')::int  as giustificati,
  count(p.id) filter (where p.stato = 'infortunato')::int   as infortuni,
  (coalesce(sps.sedute, 0) - count(p.id))::int             as non_registrate,
  case
    when coalesce(sps.sedute, 0) = 0 then null
    else round(
      count(p.id) filter (where p.stato = 'presente')::numeric * 100 / sps.sedute, 1)
  end as percentuale
from public.tesseramenti t
left join sedute_per_squadra sps on sps.squadra_id = t.squadra_id
left join public.presenze p on p.tesseramento_id = t.id
group by t.id, sps.sedute;

comment on view public.v_presenze is
  'Il denominatore sono tutte le sedute della squadra, comprese quelle senza '
  'riga per quel giocatore: non_registrate rende visibili i buchi invece di '
  'gonfiare la percentuale. percentuale è 0-100 con un decimale, nulla se la '
  'squadra non ha sedute.';
