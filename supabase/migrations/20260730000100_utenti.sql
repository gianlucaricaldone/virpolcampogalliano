-- Elenco degli utenti applicativi con la loro email.
--
-- SECURITY DEFINER perché auth.users non è leggibile da authenticated e
-- l'email sta lì. L'alternativa — leggere l'elenco con la service role da una
-- Server Action — sarebbe una pagina che scavalca le RLS per mostrare dati,
-- cioè il contrario di come è costruito tutto il resto.
--
-- In `public` e non in `app`: lo schema app non è esposto nell'API, quindi una
-- funzione lì non sarebbe chiamabile da .rpc().
create or replace function public.elenco_utenti()
returns table (
  id uuid,
  email text,
  ruolo public.ruolo_app,
  attivo boolean,
  persona_id uuid,
  persona_cognome text,
  persona_nome text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- `is distinct from` e non `<>`: senza sessione app.mio_ruolo() è NULL, il
  -- confronto darebbe NULL, l'IF non scatterebbe e la funzione restituirebbe
  -- l'elenco intero a chiunque. Solleva invece di restituire zero righe: un
  -- elenco vuoto non si distingue da "non ci sono utenti", e un controllo che
  -- fallisce in silenzio è un controllo che prima o poi qualcuno toglie.
  if app.mio_ruolo() is distinct from 'admin' then
    raise exception 'solo un amministratore può elencare gli utenti'
      using errcode = '42501';
  end if;

  return query
    select p.id, u.email::text, p.ruolo, p.attivo, p.persona_id,
           pe.cognome, pe.nome, p.created_at
    from public.profili p
    join auth.users u on u.id = p.id
    left join public.persone pe on pe.id = p.persona_id
    order by u.email;
end
$$;

comment on function public.elenco_utenti() is
  'Solo admin: solleva 42501 per chiunque altro. security definer con '
  'search_path vuoto e nomi qualificati, come le funzioni dello schema app.';

-- Postgres concede EXECUTE a PUBLIC su ogni funzione nuova. Senza questa
-- revoca la chiave anon, che viaggia nel bundle del browser, potrebbe
-- chiamare una funzione security definer che legge auth.users.
revoke execute on function public.elenco_utenti() from public;
grant execute on function public.elenco_utenti() to authenticated;
