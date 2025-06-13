-- Fix per la logica di calcolo quantità disponibile e stato giacenza

-- Aggiorna la view v_magazzino_dettaglio per calcolare correttamente le quantità
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
  -- La quantità disponibile è quella NON assegnata (non quella totale)
  m.quantita - COALESCE(
    (SELECT SUM(am.quantita - COALESCE(am.quantita_restituita, 0))
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = m.id 
     AND am.stato IN ('attiva', 'parziale')
     AND am.stagione_id = m.stagione_id),
    0
  ) as quantita_disponibile,
  -- Lo stato giacenza si basa sulla quantità TOTALE, non su quella disponibile
  CASE 
    WHEN m.quantita = 0 THEN 'esaurito'
    WHEN m.quantita <= COALESCE(m.quantita_minima, 0) AND m.quantita_minima > 0 THEN 'sotto_scorta'
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

-- Aggiorna anche la funzione di assegnazione per verificare la disponibilità non assegnata
DROP FUNCTION IF EXISTS public.assegna_materiale_squadra CASCADE;
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
  v_quantita_disponibile integer;
BEGIN
  -- Ottieni stagione corrente
  v_stagione_id := current_season_id();
  
  -- Calcola quantità disponibile (non assegnata)
  SELECT m.quantita - COALESCE(
    (SELECT SUM(am.quantita - COALESCE(am.quantita_restituita, 0))
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = p_materiale_id 
     AND am.stato IN ('attiva', 'parziale')
     AND am.stagione_id = v_stagione_id),
    0
  ) INTO v_quantita_disponibile
  FROM public.magazzino m
  WHERE m.id = p_materiale_id;
  
  -- Verifica disponibilità
  IF v_quantita_disponibile < p_quantita THEN
    RAISE EXCEPTION 'Quantità non disponibile. Disponibili per assegnazione: %, Richieste: %', v_quantita_disponibile, p_quantita;
  END IF;
  
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
  
  -- Registra movimento (senza decrementare la quantità fisica)
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
    'assegnazione',
    p_quantita,
    (SELECT quantita FROM public.magazzino WHERE id = p_materiale_id),
    (SELECT quantita FROM public.magazzino WHERE id = p_materiale_id), -- Quantità fisica non cambia
    'Assegnazione materiale a squadra',
    p_squadra_id,
    auth.uid(),
    p_note,
    v_stagione_id
  );
  
  RETURN v_assegnazione_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggiorna la funzione registra_movimento_magazzino per gestire correttamente assegnazioni
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

  -- Calcola nuova quantità (assegnazioni NON cambiano la quantità fisica)
  IF p_tipo_movimento IN ('carico', 'restituzione', 'inventario_iniziale') THEN
    v_quantita_dopo := v_quantita_attuale + p_quantita;
  ELSIF p_tipo_movimento IN ('scarico') THEN
    -- Solo lo scarico (perdita/danno) riduce la quantità fisica
    v_quantita_dopo := v_quantita_attuale - p_quantita;
    IF v_quantita_dopo < 0 THEN
      RAISE EXCEPTION 'Quantità insufficiente. Disponibili: %, Richieste: %', v_quantita_attuale, p_quantita;
    END IF;
  ELSIF p_tipo_movimento = 'rettifica' THEN
    v_quantita_dopo := p_quantita;
  ELSIF p_tipo_movimento = 'assegnazione' THEN
    -- Assegnazione non cambia la quantità fisica
    v_quantita_dopo := v_quantita_attuale;
  END IF;

  -- Aggiorna quantità solo se necessario
  IF v_quantita_dopo != v_quantita_attuale THEN
    UPDATE public.magazzino
    SET quantita = v_quantita_dopo,
        updated_at = now()
    WHERE id = p_materiale_id;
  END IF;

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

-- Commenti per documentazione
COMMENT ON VIEW public.v_magazzino_dettaglio IS 'Vista dettagliata articoli magazzino. quantita_disponibile = quantità non assegnata, stato_giacenza basato su quantità totale fisica';
COMMENT ON FUNCTION public.assegna_materiale_squadra IS 'Assegna materiale a squadra. Non riduce la quantità fisica, solo quella disponibile per assegnazione';