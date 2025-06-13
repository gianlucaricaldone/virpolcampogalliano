-- Migration per aggiungere gestione stagioni e migliorare assegnazioni materiale

-- 1. Funzione helper per ottenere la stagione corrente (creata per prima)
CREATE OR REPLACE FUNCTION current_season_id()
RETURNS uuid AS $$
DECLARE
  v_season_id uuid;
BEGIN
  SELECT id INTO v_season_id
  FROM public.stagioni_sportive
  WHERE attiva = true
  LIMIT 1;
  
  RETURN v_season_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Aggiungere stagione_id alle tabelle necessarie se non presente
ALTER TABLE public.magazzino 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id) DEFAULT current_season_id();

ALTER TABLE public.assegnazioni_materiale
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id) DEFAULT current_season_id();

ALTER TABLE public.movimenti_magazzino
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id) DEFAULT current_season_id();

-- 3. Aggiornare la funzione di registrazione movimento per includere stagione
DROP FUNCTION IF EXISTS public.registra_movimento_magazzino CASCADE;

CREATE OR REPLACE FUNCTION public.registra_movimento_magazzino(
  p_materiale_id uuid,
  p_tipo_movimento text,
  p_quantita integer,
  p_causale text,
  p_squadra_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_quantita_attuale integer;
  v_quantita_dopo integer;
  v_movimento_id uuid;
  v_stagione_id uuid;
BEGIN
  -- Ottieni stagione corrente
  v_stagione_id := current_season_id();
  
  -- Ottieni quantità attuale con lock
  SELECT quantita INTO v_quantita_attuale
  FROM public.magazzino
  WHERE id = p_materiale_id
  FOR UPDATE;

  -- Calcola nuova quantità
  IF p_tipo_movimento IN ('carico', 'restituzione', 'inventario_iniziale') THEN
    v_quantita_dopo := v_quantita_attuale + p_quantita;
  ELSIF p_tipo_movimento IN ('scarico', 'assegnazione') THEN
    v_quantita_dopo := v_quantita_attuale - p_quantita;
    IF v_quantita_dopo < 0 THEN
      RAISE EXCEPTION 'Quantità insufficiente. Disponibili: %, Richieste: %', v_quantita_attuale, p_quantita;
    END IF;
  ELSIF p_tipo_movimento = 'rettifica' THEN
    v_quantita_dopo := p_quantita;
  END IF;

  -- Aggiorna quantità
  UPDATE public.magazzino
  SET quantita = v_quantita_dopo,
      updated_at = now()
  WHERE id = p_materiale_id;

  -- Registra movimento
  INSERT INTO public.movimenti_magazzino (
    materiale_id,
    tipo_movimento,
    quantita,
    quantita_prima,
    quantita_dopo,
    causale,
    squadra_id,
    utente_id,
    note,
    stagione_id
  ) VALUES (
    p_materiale_id,
    p_tipo_movimento,
    p_quantita,
    v_quantita_attuale,
    v_quantita_dopo,
    p_causale,
    p_squadra_id,
    auth.uid(),
    p_note,
    v_stagione_id
  ) RETURNING id INTO v_movimento_id;

  RETURN v_movimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Funzione per assegnare materiale a squadra
CREATE OR REPLACE FUNCTION public.assegna_materiale_squadra(
  p_materiale_id uuid,
  p_squadra_id uuid,
  p_quantita integer,
  p_note text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_assegnazione_id uuid;
  v_movimento_id uuid;
  v_stagione_id uuid;
BEGIN
  -- Ottieni stagione corrente
  v_stagione_id := current_season_id();
  
  -- Crea assegnazione
  INSERT INTO public.assegnazioni_materiale (
    materiale_id,
    squadra_id,
    data_assegnazione,
    quantita,
    stato,
    note,
    utente_id,
    stagione_id
  ) VALUES (
    p_materiale_id,
    p_squadra_id,
    CURRENT_DATE,
    p_quantita,
    'attiva',
    p_note,
    auth.uid(),
    v_stagione_id
  ) RETURNING id INTO v_assegnazione_id;
  
  -- Registra movimento (il trigger gestirà l'aggiornamento quantità)
  v_movimento_id := registra_movimento_magazzino(
    p_materiale_id,
    'assegnazione',
    p_quantita,
    'Assegnazione materiale a squadra',
    p_squadra_id,
    p_note
  );
  
  RETURN v_assegnazione_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Funzione per restituire materiale
CREATE OR REPLACE FUNCTION public.restituisci_materiale_squadra(
  p_assegnazione_id uuid,
  p_quantita_restituita integer DEFAULT NULL,
  p_condizione text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_assegnazione record;
  v_quantita_da_restituire integer;
BEGIN
  -- Ottieni dettagli assegnazione
  SELECT * INTO v_assegnazione
  FROM public.assegnazioni_materiale
  WHERE id = p_assegnazione_id
  AND stato = 'attiva'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assegnazione non trovata o già restituita';
  END IF;
  
  -- Se non specificata, restituisci tutta la quantità
  v_quantita_da_restituire := COALESCE(p_quantita_restituita, v_assegnazione.quantita);
  
  -- Aggiorna assegnazione
  UPDATE public.assegnazioni_materiale
  SET 
    quantita_restituita = v_quantita_da_restituire,
    data_restituzione = CURRENT_DATE,
    stato = CASE 
      WHEN v_quantita_da_restituire = quantita THEN 'restituita'
      ELSE 'parziale'
    END,
    condizione_restituzione = p_condizione,
    note = COALESCE(note || E'\n' || p_note, p_note)
  WHERE id = p_assegnazione_id;
  
  -- Registra movimento di restituzione
  PERFORM registra_movimento_magazzino(
    v_assegnazione.materiale_id,
    'restituzione',
    v_quantita_da_restituire,
    'Restituzione materiale da squadra',
    v_assegnazione.squadra_id,
    p_note
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Aggiornare view con filtro stagione
DROP VIEW IF EXISTS public.v_magazzino_dettaglio CASCADE;
CREATE VIEW public.v_magazzino_dettaglio AS
SELECT 
  m.*,
  COALESCE(
    (SELECT SUM(am.quantita - COALESCE(am.quantita_restituita, 0))
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = m.id 
     AND am.stato IN ('attiva', 'parziale')
     AND am.stagione_id = m.stagione_id),
    0
  ) as quantita_assegnata,
  m.quantita as quantita_disponibile,
  CASE 
    WHEN m.quantita <= COALESCE(m.quantita_minima, 0) THEN 'sotto_scorta'
    WHEN m.quantita = 0 THEN 'esaurito'
    ELSE 'disponibile'
  END as stato_giacenza,
  (
    SELECT json_agg(
      json_build_object(
        'id', am.id,
        'squadra_id', s.id,
        'squadra_nome', s.nome,
        'quantita', am.quantita,
        'quantita_restituita', COALESCE(am.quantita_restituita, 0),
        'data_assegnazione', am.data_assegnazione,
        'stato', am.stato
      )
    )
    FROM public.assegnazioni_materiale am
    JOIN public.squadre s ON am.squadra_id = s.id
    WHERE am.materiale_id = m.id 
    AND am.stato IN ('attiva', 'parziale')
    AND am.stagione_id = m.stagione_id
  ) as assegnazioni_attive,
  st.nome as stagione_nome
FROM public.magazzino m
LEFT JOIN public.stagioni_sportive st ON m.stagione_id = st.id;

-- 7. View per assegnazioni con dettagli
CREATE OR REPLACE VIEW public.v_assegnazioni_dettaglio AS
SELECT 
  am.*,
  m.nome_articolo,
  m.tipo_materiale,
  m.categoria as materiale_categoria,
  m.codice_tracking,
  s.nome as squadra_nome,
  s.categoria as squadra_categoria,
  u.nome || ' ' || u.cognome as assegnato_da,
  st.nome as stagione_nome,
  am.quantita - COALESCE(am.quantita_restituita, 0) as quantita_ancora_assegnata
FROM public.assegnazioni_materiale am
JOIN public.magazzino m ON am.materiale_id = m.id
JOIN public.squadre s ON am.squadra_id = s.id
LEFT JOIN public.users u ON am.utente_id = u.id
LEFT JOIN public.stagioni_sportive st ON am.stagione_id = st.id;

-- 8. Indici per performance
CREATE INDEX IF NOT EXISTS idx_magazzino_stagione ON public.magazzino(stagione_id);
CREATE INDEX IF NOT EXISTS idx_assegnazioni_stagione ON public.assegnazioni_materiale(stagione_id);
CREATE INDEX IF NOT EXISTS idx_movimenti_stagione ON public.movimenti_magazzino(stagione_id);

-- 9. RLS policies per assegnazioni considerando stagione
DROP POLICY IF EXISTS "assegnazioni_materiale_select_policy" ON public.assegnazioni_materiale;
CREATE POLICY "assegnazioni_materiale_select_policy" ON public.assegnazioni_materiale
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND stagione_id IN (
    SELECT id FROM public.stagioni_sportive WHERE attiva = true
    UNION
    SELECT stagione_id FROM public.users WHERE id = auth.uid()
  )
);

-- 10. Trigger per impostare stagione automaticamente su insert
CREATE OR REPLACE FUNCTION public.set_current_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stagione_id IS NULL THEN
    NEW.stagione_id := current_season_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_magazzino_season
BEFORE INSERT ON public.magazzino
FOR EACH ROW
EXECUTE FUNCTION public.set_current_season();

CREATE TRIGGER set_assegnazioni_season
BEFORE INSERT ON public.assegnazioni_materiale
FOR EACH ROW
EXECUTE FUNCTION public.set_current_season();

CREATE TRIGGER set_movimenti_season
BEFORE INSERT ON public.movimenti_magazzino
FOR EACH ROW
EXECUTE FUNCTION public.set_current_season();

-- Commenti per documentazione
COMMENT ON FUNCTION public.assegna_materiale_squadra IS 'Assegna materiale a una squadra con gestione automatica movimento e stagione';
COMMENT ON FUNCTION public.restituisci_materiale_squadra IS 'Gestisce la restituzione di materiale da parte di una squadra';
COMMENT ON VIEW public.v_assegnazioni_dettaglio IS 'Vista dettagliata di tutte le assegnazioni con informazioni complete';