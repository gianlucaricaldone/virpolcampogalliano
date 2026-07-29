-- Anagrafica permanente e account applicativi.
-- Nessun organization_id: l'applicazione è a organizzazione singola.

create type public.ruolo_app as enum ('admin', 'dirigente', 'allenatore');

create table public.persone (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  cognome        text not null,
  data_nascita   date not null,
  codice_fiscale text unique,
  email          text,
  telefono       text,
  indirizzo      text,
  citta          text,
  cap            text,
  provincia      text,
  note           text,
  attiva         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column public.persone.attiva is
  'Archiviazione soft: le persone non si cancellano, si disattivano.';

create index persone_cognome_idx on public.persone (cognome, nome);

create table public.profili (
  id         uuid primary key references auth.users (id) on delete cascade,
  persona_id uuid references public.persone (id) on delete restrict,
  ruolo      public.ruolo_app not null,
  attivo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profili_allenatore_ha_persona
    check (ruolo <> 'allenatore' or persona_id is not null)
);

comment on constraint profili_allenatore_ha_persona on public.profili is
  'Le RLS dell''allenatore passano da profili.persona_id a incarichi_staff: '
  'un allenatore senza persona collegata non vedrebbe nessuna squadra.';

create index profili_persona_idx on public.profili (persona_id);

-- Aggiornamento automatico di updated_at su tutte le tabelle che lo hanno.
create or replace function public.tocca_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger persone_updated_at before update on public.persone
  for each row execute function public.tocca_updated_at();
create trigger profili_updated_at before update on public.profili
  for each row execute function public.tocca_updated_at();
