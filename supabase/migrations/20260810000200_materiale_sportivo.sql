-- Chi ha ricevuto il materiale sportivo, e in che taglia.
--
-- Due fatti indipendenti, e questa è la differenza che conta rispetto alla
-- visita medica: là `visita_consegnata_il` esiste solo se `visita_consegnata`
-- è vera, perché una data di consegna su un certificato mai arrivato è una
-- contraddizione. Qui no. L'ordine reale del lavoro è: la segreteria raccoglie
-- le taglie, ordina il materiale, poi lo consegna — quindi «taglia M, non
-- ancora consegnato» è lo stato normale di metà stagione, non un errore. Un
-- vincolo di coerenza sul modello della visita renderebbe inesprimibile
-- proprio il caso per cui si registra la taglia.
--
-- Nessuna vista nuova e nessuna colonna in `v_visite`: qui non c'è niente da
-- derivare — nessuna soglia, nessun confronto con `current_date`, nessuno stato
-- calcolato. Sono due colonne che si leggono come sono scritte, e le legge
-- `elencaTesseramenti`, che passa già su questa tabella. Una vista in mezzo
-- sarebbe un giro in più che non aggiunge una regola.

alter table public.tesseramenti
  add column materiale_consegnato boolean not null default false,
  add column materiale_taglia text;

comment on column public.tesseramenti.materiale_consegnato is
  'Il materiale sportivo è stato consegnato al tesserato. Indipendente dalla '
  'taglia: si registra la taglia prima di ordinare, quindi una taglia senza '
  'consegna è lo stato normale in attesa della fornitura.';

comment on column public.tesseramenti.materiale_taglia is
  'Taglia del materiale, dalla scala di vincolo materiale_taglia_ammessa. '
  'Nulla finché nessuno l''ha chiesta.';

-- La scala è chiusa perché la taglia si filtra: a testo libero la stessa
-- misura arriverebbe come 'M', 'm', 'media', e il filtro mostrerebbe tre voci
-- per una taglia sola. Estenderla è una migration di una riga; ricucire i
-- valori divergenti dopo una stagione non lo è.
--
-- La scala tiene sia il settore giovanile sia gli adulti dello staff: la
-- colonna vive sui tesseramenti, e non tutti i tesserati sono ragazzi.
alter table public.tesseramenti
  add constraint materiale_taglia_ammessa
  check (
    materiale_taglia is null
    or materiale_taglia in ('3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL')
  );
