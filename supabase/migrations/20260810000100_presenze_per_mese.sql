-- Le stesse statistiche di presenza, ma per mese.
--
-- `v_presenze` e `v_presenze_squadra` aggregano la stagione intera e non hanno
-- una dimensione temporale: "quante presenze in ottobre" non era una domanda
-- esprimibile. Filtrare in TypeScript non era un'opzione — la percentuale è una
-- regola di business e le regole vivono nello SQL, in un posto solo. Se il
-- denominatore si calcolasse anche in TS, prima o poi l'elenco per stagione e
-- quello per mese direbbero due cose diverse per la stessa squadra.
--
-- Quindi due viste sorelle delle esistenti, con `mese` in più e ogni metrica
-- ricalcolata su quel mese, denominatore compreso: le sedute del mese, non
-- quelle della stagione.
--
-- `mese` è il primo giorno del mese come `date` e non un testo 'YYYY-MM':
-- ordina correttamente, si confronta con un intervallo e non dipende dal
-- locale di chi legge.

create view public.v_presenze_mese with (security_invoker = true) as
with mesi as (
  select squadra_id, date_trunc('month', data)::date as mese, count(*)::int as sedute
  from public.sedute_allenamento
  group by squadra_id, date_trunc('month', data)::date
),
-- Le presenze con il mese della loro seduta accanto: senza questo passaggio il
-- join dovrebbe confrontare il mese dentro una condizione di LEFT JOIN, e le
-- presenze degli altri mesi entrerebbero comunque nel conteggio con la seduta
-- a null.
presenze_datate as (
  select p.tesseramento_id, p.stato, date_trunc('month', s.data)::date as mese
  from public.presenze p
  join public.sedute_allenamento s on s.id = p.seduta_id
)
select
  t.id as tesseramento_id,
  t.stagione_id,
  t.squadra_id,
  t.persona_id,
  m.mese,
  m.sedute as sedute_squadra,
  count(pm.stato) filter (where pm.stato = 'presente')::int     as presenti,
  count(pm.stato) filter (where pm.stato = 'assente')::int      as assenti,
  count(pm.stato) filter (where pm.stato = 'giustificato')::int  as giustificati,
  count(pm.stato) filter (where pm.stato = 'infortunato')::int   as infortuni,
  (m.sedute - count(pm.stato))::int                             as non_registrate,
  -- Nessun ramo per il denominatore a zero: `mesi` nasce dalle sedute
  -- esistenti, quindi un mese senza sedute non produce righe.
  round(count(pm.stato) filter (where pm.stato = 'presente')::numeric * 100 / m.sedute, 1)
    as percentuale
-- `join` e non `left join` su mesi: un tesserato senza squadra non ha sedute a
-- cui essere confrontato, e una riga con mese nullo non servirebbe a nessuno.
from public.tesseramenti t
join mesi m on m.squadra_id = t.squadra_id
left join presenze_datate pm on pm.tesseramento_id = t.id and pm.mese = m.mese
group by t.id, t.stagione_id, t.squadra_id, t.persona_id, m.mese, m.sedute;

comment on view public.v_presenze_mese is
  'Come v_presenze, un mese alla volta: il denominatore sono le sedute di QUEL '
  'mese. security_invoker, quindi un allenatore vede solo i propri.';

create view public.v_presenze_squadra_mese with (security_invoker = true) as
with mesi as (
  select squadra_id, date_trunc('month', data)::date as mese, count(*)::int as sedute
  from public.sedute_allenamento
  group by squadra_id, date_trunc('month', data)::date
),
presenze_datate as (
  select p.tesseramento_id, p.squadra_id, p.stato, date_trunc('month', s.data)::date as mese
  from public.presenze p
  join public.sedute_allenamento s on s.id = p.seduta_id
)
select
  s.id as squadra_id,
  s.stagione_id,
  m.mese,
  -- DISTINCT come nella vista di stagione: il join con le presenze moltiplica
  -- le righe dei tesseramenti, e un count() semplice gonfierebbe il
  -- denominatore contando ogni giocatore una volta per presenza.
  count(distinct t.id)::int as tesserati,
  m.sedute,
  count(pm.stato) filter (where pm.stato = 'presente')::int    as presenti,
  count(pm.stato) filter (where pm.stato = 'assente')::int     as assenti,
  count(pm.stato) filter (where pm.stato = 'giustificato')::int as giustificati,
  count(pm.stato) filter (where pm.stato = 'infortunato')::int  as infortuni,
  (m.sedute * count(distinct t.id) - count(pm.stato))::int      as non_registrate,
  case
    when count(distinct t.id) = 0 then null
    else round(
      count(pm.stato) filter (where pm.stato = 'presente')::numeric * 100
      / (m.sedute * count(distinct t.id)), 1)
  end as percentuale
from public.squadre s
join mesi m on m.squadra_id = s.id
left join public.tesseramenti t on t.squadra_id = s.id
left join presenze_datate pm on pm.tesseramento_id = t.id and pm.mese = m.mese
group by s.id, s.stagione_id, m.mese, m.sedute;

comment on view public.v_presenze_squadra_mese is
  'Come v_presenze_squadra, un mese alla volta. Denominatore: sedute del mese '
  'per numero di tesserati.';

-- Gli stessi privilegi delle due viste di stagione. Non servono policy: sono
-- security_invoker e le RLS delle tabelle sotto fanno già il filtro sulle righe.
grant select on public.v_presenze_mese, public.v_presenze_squadra_mese
  to authenticated, service_role;

-- `alter default privileges` del baseline copre già anon, ma non le viste
-- create da migration successive su un progetto ospitato, dove il default
-- concede: revoca esplicita, come in 20260809000300_recinto_anon.sql.
revoke all on public.v_presenze_mese, public.v_presenze_squadra_mese from anon;
