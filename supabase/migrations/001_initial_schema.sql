-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create enums
create type user_role as enum ('admin', 'dirigente', 'allenatore', 'tesserato', 'genitore');
create type stato_pagamento as enum ('pagato', 'non_pagato', 'parziale');
create type tipo_presenza as enum ('allenamento', 'partita');

-- Create users table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role user_role default 'tesserato',
  squadra_id uuid[] default array[]::uuid[],
  nome text,
  cognome text,
  telefono text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create squadre table
create table public.squadre (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  categoria text not null,
  annata integer not null,
  foto_squadra text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tesserati table
create table public.tesserati (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  cognome text not null,
  data_nascita date not null,
  codice_fiscale text not null unique,
  squadra_id uuid references public.squadre(id) on delete cascade,
  ruolo_squadra text not null,
  email text,
  telefono text,
  indirizzo text,
  citta text,
  cap text,
  documento_identita text,
  certificato_medico text,
  scadenza_certificato date,
  stato_pagamento stato_pagamento default 'non_pagato',
  note_pagamento text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create presenze table
create table public.presenze (
  id uuid default uuid_generate_v4() primary key,
  tesserato_id uuid references public.tesserati(id) on delete cascade,
  data date not null,
  tipo tipo_presenza not null,
  presente boolean default false,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create partite table
create table public.partite (
  id uuid default uuid_generate_v4() primary key,
  squadra_id uuid references public.squadre(id) on delete cascade,
  data date not null,
  ora time not null,
  campo text not null,
  avversario text not null,
  risultato text,
  tipo_competizione text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create convocazioni table
create table public.convocazioni (
  id uuid default uuid_generate_v4() primary key,
  partita_id uuid references public.partite(id) on delete cascade,
  tesserato_id uuid references public.tesserati(id) on delete cascade,
  stato text default 'convocato',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(partita_id, tesserato_id)
);

-- Create campi table
create table public.campi (
  id uuid default uuid_generate_v4() primary key,
  nome text not null unique,
  tipo text not null,
  caratteristiche text,
  coordinate text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create calendario_campi table
create table public.calendario_campi (
  id uuid default uuid_generate_v4() primary key,
  campo_id uuid references public.campi(id) on delete cascade,
  data date not null,
  ora_inizio time not null,
  ora_fine time not null,
  tipo_attivita text not null,
  squadra_id uuid references public.squadre(id) on delete cascade,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tornei table
create table public.tornei (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  data_inizio date not null,
  data_fine date not null,
  stato text default 'pianificato',
  regolamento jsonb,
  costo_iscrizione decimal(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create iscrizioni_torneo table
create table public.iscrizioni_torneo (
  id uuid default uuid_generate_v4() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade,
  nome_societa text not null,
  email_contatto text not null,
  telefono_contatto text,
  numero_squadre integer default 1,
  documenti jsonb,
  stato_iscrizione text default 'in_attesa',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create magazzino table
create table public.magazzino (
  id uuid default uuid_generate_v4() primary key,
  tipo_materiale text not null,
  nome_articolo text not null,
  quantita integer not null default 0,
  stato text default 'disponibile',
  ubicazione text,
  codice_tracking text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create assegnazioni_materiale table
create table public.assegnazioni_materiale (
  id uuid default uuid_generate_v4() primary key,
  materiale_id uuid references public.magazzino(id) on delete cascade,
  squadra_id uuid references public.squadre(id) on delete cascade,
  data_assegnazione date not null,
  data_restituzione date,
  quantita integer not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create eventi_economici table (private to admin)
create table public.eventi_economici (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  data_evento date not null,
  tipo text not null,
  budget_preventivo decimal(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create movimenti_economici table
create table public.movimenti_economici (
  id uuid default uuid_generate_v4() primary key,
  evento_id uuid references public.eventi_economici(id) on delete cascade,
  tipo text not null check (tipo in ('entrata', 'uscita')),
  categoria text not null,
  importo decimal(10,2) not null,
  descrizione text not null,
  data_movimento date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.squadre enable row level security;
alter table public.tesserati enable row level security;
alter table public.presenze enable row level security;
alter table public.partite enable row level security;
alter table public.convocazioni enable row level security;
alter table public.campi enable row level security;
alter table public.calendario_campi enable row level security;
alter table public.tornei enable row level security;
alter table public.iscrizioni_torneo enable row level security;
alter table public.magazzino enable row level security;
alter table public.assegnazioni_materiale enable row level security;
alter table public.eventi_economici enable row level security;
alter table public.movimenti_economici enable row level security;

-- Create function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_updated_at before update on public.users
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.squadre
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.tesserati
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.partite
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.campi
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.tornei
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.iscrizioni_torneo
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.magazzino
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.eventi_economici
  for each row execute procedure public.handle_updated_at();