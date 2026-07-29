create type public.ruolo_staff as enum ('allenatore', 'vice_allenatore', 'dirigente_squadra');

create table public.tesseramenti (
  id                   uuid primary key default gen_random_uuid(),
  persona_id           uuid not null references public.persone (id) on delete restrict,
  stagione_id          uuid not null references public.stagioni (id) on delete restrict,
  squadra_id           uuid,
  numero_maglia        integer,
  visita_consegnata_il date,
  visita_scadenza      date,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (persona_id, stagione_id),
  constraint tesseramenti_maglia_intervallo
    check (numero_maglia is null or numero_maglia between 1 and 99),
  -- Chiave esterna composita: la squadra deve appartenere alla stessa stagione
  -- del tesseramento. Nel vecchio schema questo errore era possibile e muto.
  --
  -- ON DELETE SET NULL con l'elenco colonne (squadra_id): richiede Postgres
  -- 15. Senza l'elenco, un SET NULL su una FK composita annulla TUTTE le
  -- colonne locali della chiave, quindi anche stagione_id — che è NOT NULL —
  -- e la DELETE su squadre fallirebbe. La semantica voluta è: la squadra
  -- viene cancellata, il tesserato resta iscritto alla stagione senza
  -- squadra assegnata.
  constraint tesseramenti_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete set null (squadra_id)
);

comment on column public.tesseramenti.squadra_id is
  'Nullo = tesserato ma non ancora assegnato a una squadra.';
comment on column public.tesseramenti.visita_consegnata_il is
  'Informativo. Lo stato della visita si calcola da visita_scadenza: i dati '
  'storici migrati non hanno la data di consegna.';

-- Il vincolo sulla maglia è un indice parziale: Postgres non ammette WHERE
-- in una UNIQUE dichiarata inline.
create unique index tesseramenti_squadra_maglia_uidx
  on public.tesseramenti (squadra_id, numero_maglia)
  where numero_maglia is not null;

create index tesseramenti_stagione_squadra_idx
  on public.tesseramenti (stagione_id, squadra_id);
create index tesseramenti_persona_idx on public.tesseramenti (persona_id);
create index tesseramenti_visita_scadenza_idx
  on public.tesseramenti (visita_scadenza) where visita_scadenza is not null;

create table public.incarichi_staff (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references public.persone (id) on delete restrict,
  stagione_id uuid not null,
  squadra_id  uuid not null,
  ruolo       public.ruolo_staff not null,
  created_at  timestamptz not null default now(),
  unique (persona_id, squadra_id, ruolo),
  constraint incarichi_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete cascade
);

comment on table public.incarichi_staff is
  'Una riga per incarico: sostituisce le colonne allenatore_id, '
  'vice_allenatore_1_id e vice_allenatore_2_id del vecchio schema.';

create index incarichi_squadra_idx on public.incarichi_staff (squadra_id);
create index incarichi_persona_idx on public.incarichi_staff (persona_id);

create trigger tesseramenti_updated_at before update on public.tesseramenti
  for each row execute function public.tocca_updated_at();
