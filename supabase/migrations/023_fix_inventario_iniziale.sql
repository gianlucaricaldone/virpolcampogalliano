-- Fix per il bug del raddoppio quantità nell'inventario iniziale

-- Correggi la funzione registra_movimento_magazzino per gestire correttamente l'inventario iniziale
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
  IF p_tipo_movimento = 'inventario_iniziale' THEN
    -- Inventario iniziale: la quantità è già stata impostata al momento della creazione
    -- Non modificare la quantità, registra solo il movimento
    v_quantita_dopo := v_quantita_attuale;
  ELSIF p_tipo_movimento IN ('carico', 'restituzione') THEN
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

-- Opzionale: Script per correggere dati esistenti che potrebbero avere quantità raddoppiate
-- ATTENZIONE: Esegui solo se hai dati duplicati

/*
-- Query per identificare articoli con possibili quantità raddoppiate
SELECT 
  m.id,
  m.nome_articolo,
  m.quantita_iniziale,
  m.quantita as quantita_attuale,
  (
    SELECT COUNT(*) 
    FROM movimenti_magazzino mm 
    WHERE mm.materiale_id = m.id 
    AND mm.tipo_movimento = 'inventario_iniziale'
  ) as movimenti_inventario
FROM magazzino m
WHERE m.quantita = m.quantita_iniziale * 2;

-- Se vuoi correggere automaticamente le quantità raddoppiate:
-- UPDATE magazzino 
-- SET quantita = quantita_iniziale
-- WHERE quantita = quantita_iniziale * 2
-- AND EXISTS (
--   SELECT 1 FROM movimenti_magazzino 
--   WHERE materiale_id = magazzino.id 
--   AND tipo_movimento = 'inventario_iniziale'
-- );
*/

COMMENT ON FUNCTION public.registra_movimento_magazzino IS 'Registra movimenti magazzino. Inventario iniziale non modifica quantità (già impostata alla creazione)';