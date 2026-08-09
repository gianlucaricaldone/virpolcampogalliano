-- Le squadre per il sito pubblico. UNICA view del repo senza
-- security_invoker, ed è il punto: serve anon, che sulle tabelle non ha
-- alcun diritto. Come view di proprietà di postgres legge stagioni e
-- squadre coi diritti del proprietario; il recinto sta nella definizione
-- — tre colonne, sola stagione corrente — e nel grant qui sotto.
--
-- La regola «stagione corrente» è la stessa di stagioneCorrenteDa in
-- lib/domain/stagione.ts: prima aperta per data_inizio, spareggio sul
-- codice. Se cambia lì, cambia anche qui.
create view public.v_squadre_pubbliche as
  with corrente as (
    select id
    from public.stagioni
    where stato = 'aperta'
    order by data_inizio desc, codice desc
    limit 1
  )
  select s.nome, s.categoria, s.annata
  from public.squadre s
  join corrente c on c.id = s.stagione_id
  order by s.categoria, s.nome;

comment on view public.v_squadre_pubbliche is
  'Sito pubblico: nome, categoria e annata delle squadre della stagione '
  'corrente. Unica view non security_invoker: anon la legge, le tabelle no.';

grant select on public.v_squadre_pubbliche to anon, authenticated;

-- Nessuna revoca qui: il baseline delle RLS non concede alcun privilegio di
-- tabella ad anon. Questa view è il solo varco che anon abbia mai avuto su
-- stagioni e squadre.
