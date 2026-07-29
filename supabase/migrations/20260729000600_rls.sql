create schema if not exists app;
grant usage on schema app to anon, authenticated;

-- SECURITY DEFINER: legge profili senza attivarne le RLS, così la policy su
-- profili non interroga profili e non può ricorrere. `set search_path = ''`
-- con nomi qualificati impedisce a un chiamante di dirottare la risoluzione
-- di `public.profili` su una propria tabella.
create or replace function app.mio_ruolo() returns public.ruolo_app
  language sql stable security definer set search_path = '' as $$
    select p.ruolo from public.profili p where p.id = auth.uid() and p.attivo
  $$;

create or replace function app.mia_persona() returns uuid
  language sql stable security definer set search_path = '' as $$
    select p.persona_id from public.profili p where p.id = auth.uid() and p.attivo
  $$;

create or replace function app.mie_squadre() returns setof uuid
  language sql stable security definer set search_path = '' as $$
    select i.squadra_id from public.incarichi_staff i
    where i.persona_id = app.mia_persona()
  $$;

create or replace function app.stagione_aperta(p_stagione uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.stagioni s where s.id = p_stagione and s.stato = 'aperta'
    )
  $$;

grant execute on function
  app.mio_ruolo(), app.mia_persona(), app.mie_squadre(), app.stagione_aperta(uuid)
  to anon, authenticated;

alter table public.stagioni           enable row level security;
alter table public.squadre            enable row level security;
alter table public.persone            enable row level security;
alter table public.profili            enable row level security;
alter table public.tesseramenti       enable row level security;
alter table public.incarichi_staff    enable row level security;
alter table public.sedute_allenamento enable row level security;
alter table public.presenze           enable row level security;
alter table public.quote_importi      enable row level security;
alter table public.pagamenti_quota    enable row level security;

-- NOTA AMBIENTE: nel CLI Supabase locale usato per questo progetto,
-- auto_expose_new_tables non è impostato in supabase/config.toml, che è il
-- nuovo default condiviso col cloud: le tabelle create dal ruolo postgres
-- NON sono più raggiungibili da anon/authenticated senza un grant esplicito.
-- Vedi supabase/config.toml per il commento sul campo (deprecato, rimozione
-- prevista per il 2026-10-30). Senza un grant, ogni query fallirebbe con
-- "permission denied for table" ancora prima che una policy RLS venga
-- valutata: le RLS restano comunque l'unico filtro sulle RIGHE, in loro
-- assenza per una combinazione ruolo/verbo l'accesso resta comunque negato.
--
-- anon serve solo al sito pubblico, che mostra i nomi delle squadre: sola
-- lettura e solo su queste due tabelle. Così un errore in una policy futura
-- non può esporre anagrafiche o dati finanziari a chi ha la chiave anon, che
-- viaggia nel bundle del browser. Due barriere indipendenti invece di una.
grant select on public.stagioni, public.squadre to anon;

grant select, insert, update, delete on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota
  to authenticated;

-- v_quote e v_presenze sono security_invoker: oltre alle RLS delle tabelle
-- sottostanti (già coperte sopra), serve anche il privilegio SELECT sulla
-- vista stessa per il chiamante. Nessun insert/update/delete: sono viste di
-- sola lettura.
grant select on public.v_quote, public.v_presenze to authenticated;

-- pg_default_acl del ruolo postgres concede Dxtm (truncate, references, trigger,
-- maintain) ad anon e authenticated su ogni tabella e vista creata dalle
-- migration. Le RLS non hanno un verbo per TRUNCATE: nessuna policy può
-- filtrarlo, quindi senza questa revoke la chiave anon — che viaggia nel
-- bundle del browser — può svuotare persone e pagamenti_quota per intero.
-- (TRUNCATE su una vista non è comunque eseguibile: Postgres lo rifiuta a
-- prescindere dal privilegio. Lo si revoca comunque, per coerenza con le
-- tabelle e perché una vista futura potrebbe non restare tale.) references e
-- trigger oggi non sono sfruttabili (anon e authenticated non hanno CREATE
-- su public, quindi non possiedono oggetti a cui appenderli) ma si revocano
-- comunque: sono gratis.
revoke truncate, references, trigger, maintain on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota,
  public.v_quote, public.v_presenze
  from anon, authenticated;

-- Così le tabelle create dalle migration future ereditano la restrizione
-- invece di dipendere dal fatto che qualcuno se lo ricordi.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- service_role scavalca le RLS per progetto, ma i privilegi di tabella gli
-- servono comunque. Lo usano solo gli script in scripts/, e una regola ESLint
-- vieta di importarne il client da app/, components/ e lib/repos/.
grant select, insert, update, delete on
  public.stagioni, public.squadre, public.persone, public.profili,
  public.tesseramenti, public.incarichi_staff, public.sedute_allenamento,
  public.presenze, public.quote_importi, public.pagamenti_quota
  to service_role;

-- STAGIONI: lette da tutti (il sito pubblico ne ha bisogno), scritte dall'admin.
create policy stagioni_sel on public.stagioni for select to anon, authenticated
  using (true);
create policy stagioni_ins on public.stagioni for insert to authenticated
  with check (app.mio_ruolo() = 'admin');
create policy stagioni_upd on public.stagioni for update to authenticated
  using (app.mio_ruolo() = 'admin') with check (app.mio_ruolo() = 'admin');
create policy stagioni_del on public.stagioni for delete to authenticated
  using (app.mio_ruolo() = 'admin');

-- SQUADRE: lette da tutti, scritte da admin e dirigente su stagioni aperte.
create policy squadre_sel on public.squadre for select to anon, authenticated
  using (true);
create policy squadre_ins on public.squadre for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy squadre_upd on public.squadre for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy squadre_del on public.squadre for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- PROFILI: la policy di lettura non usa subquery, quindi non può ricorrere.
create policy profili_sel_proprio on public.profili for select to authenticated
  using (id = auth.uid());
create policy profili_sel_staff on public.profili for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy profili_ins on public.profili for insert to authenticated
  with check (app.mio_ruolo() = 'admin');
create policy profili_upd on public.profili for update to authenticated
  using (app.mio_ruolo() = 'admin') with check (app.mio_ruolo() = 'admin');
create policy profili_del on public.profili for delete to authenticated
  using (app.mio_ruolo() = 'admin');

-- PERSONE: staff tutte; allenatore solo quelle presenti nelle proprie squadre.
create policy persone_sel_staff on public.persone for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_sel_allenatore on public.persone for select to authenticated
  using (
    app.mio_ruolo() = 'allenatore'
    and (
      id in (select t.persona_id from public.tesseramenti t
             where t.squadra_id in (select app.mie_squadre()))
      or id in (select i.persona_id from public.incarichi_staff i
                where i.squadra_id in (select app.mie_squadre()))
    )
  );
create policy persone_ins on public.persone for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_upd on public.persone for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'))
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy persone_del on public.persone for delete to authenticated
  using (app.mio_ruolo() = 'admin');

-- TESSERAMENTI
create policy tesseramenti_sel_staff on public.tesseramenti for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy tesseramenti_sel_allenatore on public.tesseramenti for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy tesseramenti_ins on public.tesseramenti for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy tesseramenti_upd on public.tesseramenti for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy tesseramenti_del on public.tesseramenti for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- INCARICHI STAFF
create policy incarichi_sel_staff on public.incarichi_staff for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy incarichi_sel_allenatore on public.incarichi_staff for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy incarichi_ins on public.incarichi_staff for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente')
              and app.stagione_aperta(stagione_id));
create policy incarichi_upd on public.incarichi_staff for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id))
  with check (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));
create policy incarichi_del on public.incarichi_staff for delete to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente') and app.stagione_aperta(stagione_id));

-- SEDUTE: l'allenatore le gestisce sulle proprie squadre.
create policy sedute_sel_staff on public.sedute_allenamento for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy sedute_sel_allenatore on public.sedute_allenamento for select to authenticated
  using (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre()));
create policy sedute_ins on public.sedute_allenamento for insert to authenticated
  with check (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );
create policy sedute_upd on public.sedute_allenamento for update to authenticated
  using (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  )
  with check (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );
create policy sedute_del on public.sedute_allenamento for delete to authenticated
  using (
    app.stagione_aperta(stagione_id)
    and (app.mio_ruolo() in ('admin', 'dirigente')
         or (app.mio_ruolo() = 'allenatore' and squadra_id in (select app.mie_squadre())))
  );

-- PRESENZE: la visibilità passa dalla seduta.
create policy presenze_sel_staff on public.presenze for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy presenze_sel_allenatore on public.presenze for select to authenticated
  using (
    app.mio_ruolo() = 'allenatore'
    and seduta_id in (select s.id from public.sedute_allenamento s
                      where s.squadra_id in (select app.mie_squadre()))
  );
create policy presenze_ins on public.presenze for insert to authenticated
  with check (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );
create policy presenze_upd on public.presenze for update to authenticated
  using (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  )
  with check (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );
create policy presenze_del on public.presenze for delete to authenticated
  using (
    seduta_id in (
      select s.id from public.sedute_allenamento s
      where app.stagione_aperta(s.stagione_id)
        and (app.mio_ruolo() in ('admin', 'dirigente')
             or (app.mio_ruolo() = 'allenatore'
                 and s.squadra_id in (select app.mie_squadre())))
    )
  );

-- QUOTE E PAGAMENTI: nessuna policy per allenatore né per anon.
-- La lettura non è vincolata alla stagione aperta, altrimenti lo storico
-- dei pagamenti diventerebbe invisibile invece che immutabile.
create policy quote_sel on public.quote_importi for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_ins on public.quote_importi for insert to authenticated
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_upd on public.quote_importi for update to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'))
  with check (app.mio_ruolo() in ('admin', 'dirigente'));
create policy quote_del on public.quote_importi for delete to authenticated
  using (app.mio_ruolo() = 'admin');

create policy pagamenti_sel on public.pagamenti_quota for select to authenticated
  using (app.mio_ruolo() in ('admin', 'dirigente'));
create policy pagamenti_ins on public.pagamenti_quota for insert to authenticated
  with check (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
create policy pagamenti_upd on public.pagamenti_quota for update to authenticated
  using (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  )
  with check (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
create policy pagamenti_del on public.pagamenti_quota for delete to authenticated
  using (
    app.mio_ruolo() in ('admin', 'dirigente')
    and tesseramento_id in (select t.id from public.tesseramenti t
                            where app.stagione_aperta(t.stagione_id))
  );
