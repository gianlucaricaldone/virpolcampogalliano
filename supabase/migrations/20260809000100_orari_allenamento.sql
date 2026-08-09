-- L'orario settimanale di allenamento: "il 2013/2014 si allena martedì,
-- giovedì e venerdì alle 18:15".
--
-- Non è esprimibile con sedute_allenamento, che tiene le sedute SINGOLE e
-- datate perché le presenze si appendono a quelle: una riga per il martedì
-- generico non ha una data a cui agganciare una presenza, e una seduta datata
-- non dice che la settimana dopo si ripete. Sono due fatti distinti, e finora
-- il secondo non aveva posto: il calendario della società viveva solo su un
-- foglio fuori dal gestionale.

create table public.orari_allenamento (
  id          uuid primary key default gen_random_uuid(),
  squadra_id  uuid not null,
  -- Denormalizzata come su sedute_allenamento, e per lo stesso motivo: con la
  -- FK composita qui sotto è ciò che impedisce di appendere un orario a una
  -- squadra di un'altra stagione. NOT NULL è obbligatorio: con la semantica
  -- MATCH SIMPLE una colonna nulla soddisfa una FK composita a vuoto.
  stagione_id uuid not null,
  -- Numerazione ISO, 1 = lunedì … 7 = domenica: è la stessa di
  -- `extract(isodow from data)`, quindi generare le sedute datate di un
  -- periodo da questo orario è un confronto diretto senza tabella di
  -- traduzione. Un enum in italiano si leggerebbe meglio in una select a mano
  -- e costerebbe una conversione in ogni query che tocca le date, che è
  -- l'unica cosa per cui questa colonna serve davvero.
  giorno      smallint not null,
  -- NOT NULL, al contrario di sedute_allenamento.ora_inizio: una seduta senza
  -- orario è una seduta di cui non si è annotata l'ora, un orario senza ora
  -- non è niente.
  ora_inizio  time not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint orari_giorno_iso check (giorno between 1 and 7),
  constraint orari_squadra_giorno_ora_key unique (squadra_id, giorno, ora_inizio),
  constraint orari_squadra_di_stagione
    foreign key (squadra_id, stagione_id)
    references public.squadre (id, stagione_id) on delete cascade
);

comment on table public.orari_allenamento is
  'Orario settimanale ricorrente. Le sedute effettive stanno in '
  'sedute_allenamento: questa tabella dice quando si dovrebbe allenare, '
  'quella dice quando si è allenato.';
comment on column public.orari_allenamento.giorno is
  'Giorno ISO: 1 lunedì … 7 domenica, allineato a extract(isodow from data).';

create trigger orari_allenamento_updated_at before update on public.orari_allenamento
  for each row execute function public.tocca_updated_at();

alter table public.orari_allenamento enable row level security;

-- Nessun grant ad anon. Il sito pubblico (fase 5) potrebbe volere gli orari,
-- ma è una decisione da prendere quando quella pagina esiste: la chiave anon
-- viaggia nel bundle del browser, e finora vede solo stagioni e squadre.
grant select, insert, update, delete on public.orari_allenamento to authenticated;
grant select, insert, update, delete on public.orari_allenamento to service_role;

-- truncate, references e trigger non vanno revocati qui: la migration delle
-- RLS ha impostato `alter default privileges for role postgres ... revoke`,
-- che si applica alle tabelle create dalle migration successive. La suite
-- tests/db/rls.test.ts lo verifica su questa tabella, così se quel default
-- smettesse di valere ce ne accorgeremmo qui invece che in produzione.

-- Chi scrive l'orario è la società, non il singolo allenatore: a differenza di
-- sedute_allenamento, dove l'allenatore compila le proprie, qui l'allenatore
-- legge soltanto. Il calendario settimanale incastra campi e fasce orarie fra
-- tutte le squadre, quindi una modifica unilaterale sposterebbe un'altra
-- squadra senza che nessuno lo veda.
create policy orari_sel_staff on public.orari_allenamento for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy orari_sel_allenatore on public.orari_allenamento for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy orari_ins on public.orari_allenamento for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy orari_upd on public.orari_allenamento for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy orari_del on public.orari_allenamento for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
