-- Stato della visita medica sportiva. Unica implementazione della regola:
-- non esiste una copia in TypeScript.
--
-- Perché una vista sua e non una colonna in più su v_quote: le due rispondono
-- a domande diverse e hanno cicli di vita diversi — la quota cambia quando
-- qualcuno versa, la visita quando scade il calendario. Gonfiare v_quote
-- avrebbe legato ogni lettura delle scadenze mediche alle policy di
-- quote_importi e pagamenti_quota, che l'allenatore non ha: avrebbe smesso di
-- vedere le visite dei propri giocatori, che è esattamente ciò che deve
-- vedere.
--
-- Perché lo stato si calcola dalla SCADENZA e non dalla consegna: i dati
-- storici che il piano di migrazione porterà dentro hanno solo un booleano e
-- nessuna data di consegna. Una regola basata su `visita_consegnata_il`
-- marcherebbe come "mancante" ogni record migrato, cioè tutti.
create view public.v_visite with (security_invoker = true) as
select
  t.id as tesseramento_id,
  t.stagione_id,
  t.squadra_id,
  t.persona_id,
  t.visita_scadenza,
  t.visita_consegnata_il,
  case
    when t.visita_scadenza is null then 'mancante'
    -- Il giorno di scadenza il certificato è ancora valido: `<` e non `<=`,
    -- altrimenti un ragazzo resterebbe fuori dal campo un giorno prima del
    -- dovuto e nessuno saprebbe perché.
    when t.visita_scadenza < current_date then 'scaduta'
    -- Estremo incluso: a esattamente 30 giorni la visita è già da rinnovare.
    when t.visita_scadenza <= current_date + 30 then 'in_scadenza'
    else 'valida'
  end as stato_visita,
  -- Negativo se è già scaduta, nullo se non c'è: l'interfaccia ordina per
  -- questo e mostra "scaduta da N giorni" senza rifare il conto.
  (t.visita_scadenza - current_date) as giorni_alla_scadenza
from public.tesseramenti t;

comment on view public.v_visite is
  'security_invoker: valgono le RLS di tesseramenti, quindi un allenatore vede '
  'le visite dei soli propri tesserati. Lo stato dipende da current_date, '
  'quindi la vista non è indicizzabile e cambia da sola col passare dei '
  'giorni — che è il comportamento voluto: una scadenza non si aggiorna con '
  'un job notturno.';

-- I grant delle altre viste stanno nella migration delle RLS, che gira prima
-- di questa: senza queste due righe la vista esisterebbe e ogni SELECT
-- risponderebbe "permission denied for view".
grant select on public.v_visite to authenticated;
grant select on public.v_visite to service_role;

-- La revoca dei privilegi impliciti concessi da pg_default_acl vale anche
-- qui. ALTER DEFAULT PRIVILEGES nella migration delle RLS copre le tabelle
-- create dopo, ma è per-ruolo-creatore e non copre le viste: si revoca
-- esplicitamente, come già fatto per v_quote e v_presenze.
revoke truncate, references, trigger, maintain on public.v_visite
  from anon, authenticated;
