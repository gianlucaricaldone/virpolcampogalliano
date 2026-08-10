-- I due numeri della home pubblica, calcolati sulla stagione corrente.
--
-- PERCHÉ NEL DATABASE. In home c'erano quattro cifre scritte a mano — «15+ anni
-- di storia», «8 squadre attive», «180+ atleti tesserati», «42+ trofei» — che
-- erano i valori di fallback di un hook del sito vecchio, congelati come testo.
-- Le due che il database sa contare le conta il database, per la stessa ragione
-- per cui l'elenco delle squadre non è più un array in una pagina: «mentiva a
-- ogni cambio di stagione». Le altre due spariscono: l'anno di fondazione non è
-- noto e i trofei non hanno una sorgente.
--
-- UNA VIEW NUOVA E NON UNA COLONNA IN PIÙ SU v_squadre_pubbliche. Quella è
-- riga-per-squadra: un aggregato di stagione andrebbe ripetuto identico su ogni
-- riga, la home dovrebbe leggere tutte le squadre per stampare due cifre, e a
-- zero squadre la view ha zero righe — quindi non potrebbe esprimere il numero
-- degli atleti, che è proprio il caso in cui serve.

create view public.v_numeri_pubblici as
  -- La regola «stagione corrente» è la stessa di v_squadre_pubbliche
  -- (20260809000200_sito_pubblico.sql, righe 11-17) e di stagioneCorrenteDa in
  -- lib/domain/stagione.ts: prima aperta per data_inizio, spareggio sul codice.
  -- È duplicata di proposito. Estrarla in un oggetto condiviso vorrebbe un
  -- `create or replace` sulla view già deployata, cioè allargare allo schema di
  -- produzione il raggio di una correzione di contenuti. Il prezzo della copia
  -- lo paga un test: lo spareggio è verificato anche qui, non solo là.
  with corrente as (
    select id
    from public.stagioni
    where stato = 'aperta'
    order by data_inizio desc, codice desc
    limit 1
  )
  select
    (select count(*) from public.squadre s where s.stagione_id = c.id)::int as squadre,
    -- ATLETI, NON TESSERATI. `tesseramenti` porta anche gli adulti: lo dice la
    -- scala di materiale_taglia_ammessa, che tiene le taglie da adulto perché
    -- «non tutti i tesserati sono ragazzi». Non c'è colonna di ruolo, e
    -- persone.data_nascita è facoltativa (186 su 188 non l'hanno), quindi né un
    -- flag né l'età sono utilizzabili: l'unico marcatore per stagione è
    -- incarichi_staff.
    --
    -- La correlazione su stagione_id è parte del criterio, non igiene: un
    -- allenatore del 2024-25 che oggi gioca è un atleta.
    (select count(*) from public.tesseramenti t
      where t.stagione_id = c.id
        and not exists (
          select 1 from public.incarichi_staff i
          where i.persona_id = t.persona_id
            and i.stagione_id = t.stagione_id))::int as atleti
  -- Zero righe quando nessuna stagione è aperta, invece di una riga di zeri:
  -- «non c'è una stagione» e «la stagione è vuota» non sono lo stesso fatto, e
  -- un conteggio a zero non li distingue. È così che la home evita di
  -- pubblicare «0 atleti tesserati», che di una società sportiva non è un dato
  -- ma un annuncio di chiusura.
  from corrente c;

comment on view public.v_numeri_pubblici is
  'Sito pubblico: squadre e atleti tesserati della stagione corrente, due '
  'aggregati e nient''altro. Zero righe se nessuna stagione è aperta. Non '
  'security_invoker, come v_squadre_pubbliche: anon legge questa, non le tabelle.';

-- NESSUN `with (security_invoker = true)`, ED È DELIBERATO.
--
-- v_squadre_pubbliche è l'unica view del repo senza security_invoker proprio
-- perché deve servire anon, che sulle tabelle non ha alcun privilegio: come
-- view di proprietà di postgres legge stagioni e squadre coi diritti del
-- proprietario, e le policy — che nominano solo authenticated — non entrano in
-- gioco. Questa deve fare lo stesso, e il modo di sbagliare è silenzioso: con
-- security_invoker la query fallirebbe con «permission denied for table
-- stagioni», e se una migration futura riconcedesse select ad anon riuscirebbe
-- restituendo ZERO RIGHE SENZA ERRORE — cioè 0 squadre e 0 atleti in
-- produzione, senza un log. Il test di catalogo in tests/db/sito-pubblico.test.ts
-- pinna `reloptions is null` invece di lasciarlo al ragionamento.
--
-- SOLO AGGREGATI, E NON È UNA COMODITÀ. Questa view legge `tesseramenti`
-- scavalcando le RLS della tabella più sensibile dello schema. La rende innocua
-- il fatto che esponga due count(): nessuna colonna di riga, nessun parametro,
-- nessuna persona. Aggiungere qui una colonna è una decisione di sicurezza, non
-- un'aggiunta di comodo.

-- La revoca prima del grant. Sul progetto ospitato i default privilege
-- concedono DML ad anon e authenticated su ogni tabella e view nuova creata da
-- postgres — è il difetto che 20260809000300_recinto_anon.sql ha documentato col
-- dump dello schema remoto. La revoca azzera l'auto-grant, il grant riapre il
-- solo varco che serve. In locale la prima riga è a vuoto: è il prezzo di una
-- sola storia di migration valida su entrambi gli ambienti.
--
-- Solo anon: nel backoffice nessuno legge questi conteggi, ha i numeri veri.
-- Perciò v_numeri_pubblici NON entra nell'elenco VISTE di tests/db/rls.test.ts,
-- e se una migration futura la concedesse ad authenticated quel test diventa
-- rosso da solo. È il suo mestiere.
revoke all on public.v_numeri_pubblici from anon, authenticated;
grant select on public.v_numeri_pubblici to anon;
