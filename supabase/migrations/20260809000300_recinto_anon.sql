-- Chiude il recinto di `anon` sul progetto ospitato, dove il baseline non
-- bastava.
--
-- COSA È SUCCESSO. Il baseline delle RLS commenta che il CLI locale non
-- imposta `auto_expose_new_tables`, «che è il nuovo default condiviso col
-- cloud»: quindi le tabelle create dalle migration non sarebbero raggiungibili
-- da anon senza un grant esplicito, e il baseline si limita a revocare
-- truncate/references/trigger/maintain. Sul progetto ospitato non è vero. Il
-- dump dello schema remoto, dopo il primo deploy reale, mostrava:
--
--   GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.persone TO anon;
--   ... idem su tutte le altre dieci tabelle e su tutte le view ...
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES;   -- anche per il futuro
--
-- Nessun dato è mai stato esposto: le policy nominano `authenticated`, quindi
-- per anon nessuna riga è leggibile e nessuna scrittura passa, e TRUNCATE non
-- era fra i privilegi concessi. Ma il progetto vuole due barriere indipendenti
-- — privilegio di tabella E policy — e in produzione ne restava una: una
-- policy nuova scritta male, o un `to anon` di troppo, avrebbe aperto
-- l'anagrafica a chiunque abbia la chiave anon, che viaggia nel bundle del
-- browser.
--
-- PERCHÉ UNA MIGRATION NUOVA E NON UNA CORREZIONE IN PLACE. Il baseline è
-- deployato: `supabase db push` non rieseguirà mai una versione già registrata,
-- quindi correggerlo in place lascerebbe la produzione come sta e farebbe
-- divergere in silenzio repo e database. La regola dell'immutabilità vale da
-- quando la versione è applicata, e da oggi lo è.
--
-- In locale queste istruzioni sono a vuoto (anon non ha mai avuto quei
-- privilegi) e restano innocue a ogni `db:reset`: è il prezzo per una sola
-- storia di migration valida su entrambi gli ambienti.

revoke all on all tables in schema public from anon;

-- Il default privilege del ruolo postgres è la parte che conta per il futuro:
-- senza questa riga la prossima tabella creata da una migration tornerebbe
-- raggiungibile da anon sul progetto ospitato.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;

-- Le due policy che ancora nominavano anon in produzione. Senza privilegio di
-- tabella erano già peso morto, e una regola di sicurezza morta inganna chi
-- legge: le riallineo alla definizione del baseline corretto. `drop` prima di
-- `create` perché a stagione già allineata (locale, o un progetto nuovo) la
-- policy esiste già identica.
drop policy if exists stagioni_sel on public.stagioni;
create policy stagioni_sel on public.stagioni for select to authenticated
  using (true);

drop policy if exists squadre_sel on public.squadre;
create policy squadre_sel on public.squadre for select to authenticated
  using (true);

-- Il solo varco che anon deve avere, riconcesso dopo la revoca in blocco:
-- `revoke all on all tables` ha portato via anche questo.
grant select on public.v_squadre_pubbliche to anon;
