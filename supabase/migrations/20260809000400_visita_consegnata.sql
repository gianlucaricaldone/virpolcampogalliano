-- "La visita è stata consegnata?" è un fatto a sé, e non era rappresentabile.
--
-- C'era solo `visita_consegnata_il`, una data. Chiedere alla segreteria la data
-- esatta per registrare che il certificato è arrivato significa costringerla a
-- inventarla o a lasciare il campo vuoto: nel primo caso il dato è falso, nel
-- secondo "consegnata" e "non consegnata" diventano indistinguibili. Nei dati
-- reali la data non c'è per nessuno dei 187 tesseramenti migrati — 86 hanno la
-- scadenza, zero la consegna — che è esattamente il sintomo.
--
-- Derivare il booleano da `visita_consegnata_il is not null` non basta: renderebbe
-- inesprimibile il caso normale, «consegnata sì, la data non la so».

alter table public.tesseramenti
  add column visita_consegnata boolean not null default false;

comment on column public.tesseramenti.visita_consegnata is
  'Il certificato è stato consegnato. Indipendente dalla scadenza: si può avere '
  'in mano un certificato scaduto, e una scadenza futura senza aver ricevuto '
  'nulla. Non entra in stato_visita, che dipende dalla sola scadenza.';

-- Chi ha una data di consegna l'ha per definizione consegnata. Oggi non riguarda
-- nessuna riga, ma la migration deve valere anche su un database dove qualcuno
-- quella data l'aveva compilata.
update public.tesseramenti
  set visita_consegnata = true
  where visita_consegnata_il is not null;

-- Due colonne per un fatto solo divergono, e quando divergono l'elenco dice una
-- cosa e la scheda un'altra: il vincolo impedisce la combinazione senza senso
-- (una data di consegna su una visita dichiarata non consegnata). Il contrario è
-- ammesso, ed è il caso normale: consegnata, data ignota.
alter table public.tesseramenti
  add constraint visita_consegna_coerente
  check (visita_consegnata_il is null or visita_consegnata);

-- La view espone il campo in coda: `create or replace view` pretende che le
-- colonne esistenti restino nello stesso ordine e con lo stesso tipo.
-- `stato_visita` NON cambia: dipende dalla sola scadenza, perché è quella che
-- decide se un ragazzo può scendere in campo.
create or replace view public.v_visite with (security_invoker = true) as
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
  (t.visita_scadenza - current_date) as giorni_alla_scadenza,
  t.visita_consegnata
from public.tesseramenti t;
