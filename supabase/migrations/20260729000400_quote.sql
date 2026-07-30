create type public.metodo_pagamento as enum ('contanti', 'bonifico', 'altro');

-- Tutti gli importi vivono qui, e solo qui: le RLS filtrano righe e non
-- colonne, e `stagioni` e `squadre` sono leggibili senza login per il sito
-- pubblico. Tenere gli importi fuori da quelle tabelle è ciò che impedisce
-- a un allenatore e a un utente anonimo di vederli.
create table public.quote_importi (
  id              uuid primary key default gen_random_uuid(),
  stagione_id     uuid unique references public.stagioni (id) on delete cascade,
  squadra_id      uuid unique references public.squadre (id) on delete cascade,
  tesseramento_id uuid unique references public.tesseramenti (id) on delete cascade,
  importo         numeric(10,2) not null check (importo >= 0),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint quote_importi_un_solo_livello
    check (num_nonnulls(stagione_id, squadra_id, tesseramento_id) = 1)
);

comment on constraint quote_importi_un_solo_livello on public.quote_importi is
  'Le tre UNIQUE convivono perché per ogni riga due colonne su tre sono nulle '
  'e Postgres considera i NULL distinti. Non aggiungere NULLS NOT DISTINCT.';

create table public.pagamenti_quota (
  id              uuid primary key default gen_random_uuid(),
  tesseramento_id uuid not null references public.tesseramenti (id) on delete cascade,
  importo         numeric(10,2) not null,
  data            date not null,
  metodo          public.metodo_pagamento not null default 'contanti',
  note            text,
  registrato_da   uuid references public.profili (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint pagamenti_importo_positivo check (importo > 0)
);

create index pagamenti_tesseramento_idx on public.pagamenti_quota (tesseramento_id);

create trigger quote_importi_updated_at before update on public.quote_importi
  for each row execute function public.tocca_updated_at();

-- Stato della quota. È l'unica implementazione della regola: non esiste una
-- copia in TypeScript.
create view public.v_quote with (security_invoker = true) as
with versato as (
  select tesseramento_id, sum(importo) as pagato
  from public.pagamenti_quota
  group by tesseramento_id
)
select
  t.id as tesseramento_id,
  -- stagione e squadra sull'onda della vista: senza, ogni elenco di quote
  -- dovrebbe prima leggere i tesseramenti e poi filtrare in TypeScript.
  t.stagione_id,
  t.squadra_id,
  t.persona_id,
  coalesce(qt.importo, qs.importo, qst.importo, 0)::numeric(10,2) as quota_attesa,
  -- Quale dei tre livelli sta decidendo l'importo. Serve all'interfaccia: un
  -- override di squadra, senza dirlo, sembra un errore di calcolo del default
  -- di stagione, e chi lo vede va a cercare il bug che non c'è.
  -- L'ordine dei rami segue quello del coalesce qui sopra: tenerli adiacenti
  -- è ciò che rende visibile una divergenza fra i due.
  case
    when qt.importo is not null then 'tesseramento'
    when qs.importo is not null then 'squadra'
    when qst.importo is not null then 'stagione'
    else 'nessuno'
  end as livello_importo,
  coalesce(v.pagato, 0)::numeric(10,2) as pagato,
  (coalesce(qt.importo, qs.importo, qst.importo, 0) - coalesce(v.pagato, 0))::numeric(10,2)
    as residuo,
  case
    when coalesce(qt.importo, qs.importo, qst.importo, 0) = 0 then 'saldato'
    when coalesce(v.pagato, 0) = 0 then 'non_pagato'
    when coalesce(v.pagato, 0) < coalesce(qt.importo, qs.importo, qst.importo, 0) then 'parziale'
    else 'saldato'
  end as stato
from public.tesseramenti t
left join public.quote_importi qt  on qt.tesseramento_id = t.id
left join public.quote_importi qs  on qs.squadra_id = t.squadra_id
left join public.quote_importi qst on qst.stagione_id = t.stagione_id
left join versato v on v.tesseramento_id = t.id;

comment on view public.v_quote is
  'security_invoker: le RLS delle tabelle sottostanti valgono per il chiamante. '
  'Un allenatore non ha policy su quote_importi né su pagamenti_quota, quindi '
  'legge zeri e stato ''saldato'' — nessuna cifra reale. Il layer di repository '
  'rifiuta comunque la chiamata per i ruoli non autorizzati.';
