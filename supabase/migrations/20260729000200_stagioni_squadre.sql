create type public.stato_stagione as enum ('aperta', 'chiusa');

create table public.stagioni (
  id          uuid primary key default gen_random_uuid(),
  codice      text not null unique,
  etichetta   text not null,
  data_inizio date not null,
  data_fine   date not null,
  stato       public.stato_stagione not null default 'aperta',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stagioni_date_coerenti check (data_fine > data_inizio),
  constraint stagioni_codice_forma check (codice ~ '^\d{4}-\d{2}$')
);

comment on constraint stagioni_codice_forma on public.stagioni is
  'Il codice è un segmento di URL accanto ai segmenti statici anagrafica e '
  'admin. La forma vincolata rende impossibile una collisione di rotta.';

comment on table public.stagioni is
  'Nessun flag `attiva`: la stagione corrente è la prima con stato = ''aperta'' '
  'ordinata per data_inizio desc.';

create table public.squadre (
  id          uuid primary key default gen_random_uuid(),
  stagione_id uuid not null references public.stagioni (id) on delete restrict,
  nome        text not null,
  categoria   text not null,
  annata      integer,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (stagione_id, nome),
  -- Appoggio per le chiavi esterne composite di tesseramenti, incarichi_staff
  -- e sedute_allenamento: ridondante rispetto alla primary key, ma necessaria.
  unique (id, stagione_id)
);

create index squadre_stagione_idx on public.squadre (stagione_id);

create trigger stagioni_updated_at before update on public.stagioni
  for each row execute function public.tocca_updated_at();
create trigger squadre_updated_at before update on public.squadre
  for each row execute function public.tocca_updated_at();
