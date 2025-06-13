-- Migration per aggiungere sistema di cronologia al magazzino

-- 1. Creare tabella movimenti_magazzino
CREATE TABLE IF NOT EXISTS public.movimenti_magazzino (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  materiale_id uuid REFERENCES public.magazzino(id) ON DELETE CASCADE NOT NULL,
  tipo_movimento text NOT NULL CHECK (tipo_movimento IN ('carico', 'scarico', 'assegnazione', 'restituzione', 'rettifica', 'inventario_iniziale')),
  quantita integer NOT NULL,
  quantita_prima integer NOT NULL,
  quantita_dopo integer NOT NULL,
  causale text NOT NULL,
  squadra_id uuid REFERENCES public.squadre(id),
  utente_id uuid REFERENCES public.users(id) NOT NULL,
  note text,
  data_movimento timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aggiornare tabella magazzino con campi aggiuntivi
ALTER TABLE public.magazzino
ADD COLUMN IF NOT EXISTS quantita_iniziale integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantita_minima integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS categoria text,
ADD COLUMN IF NOT EXISTS taglia text,
ADD COLUMN IF NOT EXISTS colore text,
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- 3. Aggiornare tabella assegnazioni_materiale
ALTER TABLE public.assegnazioni_materiale
ADD COLUMN IF NOT EXISTS stato text DEFAULT 'attiva' CHECK (stato IN ('attiva', 'restituita', 'parziale')),
ADD COLUMN IF NOT EXISTS quantita_restituita integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS utente_id uuid REFERENCES public.users(id);

-- 4. Funzione per registrare movimenti
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
BEGIN
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
    v_quantita_dopo := p_quantita; -- Per rettifica, p_quantita è il valore assoluto nuovo
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
    note
  ) VALUES (
    p_materiale_id,
    p_tipo_movimento,
    p_quantita,
    v_quantita_attuale,
    v_quantita_dopo,
    p_causale,
    p_squadra_id,
    auth.uid(),
    p_note
  ) RETURNING id INTO v_movimento_id;

  RETURN v_movimento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger per tracciare modifiche dirette
CREATE OR REPLACE FUNCTION public.log_modifica_diretta_magazzino()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo se la quantità cambia e non è stata già registrata da registra_movimento_magazzino
  IF NEW.quantita != OLD.quantita AND NOT EXISTS (
    SELECT 1 FROM public.movimenti_magazzino
    WHERE materiale_id = NEW.id
    AND data_movimento >= now() - interval '1 second'
  ) THEN
    INSERT INTO public.movimenti_magazzino (
      materiale_id,
      tipo_movimento,
      quantita,
      quantita_prima,
      quantita_dopo,
      causale,
      utente_id
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.quantita > OLD.quantita THEN 'rettifica'
        ELSE 'rettifica'
      END,
      ABS(NEW.quantita - OLD.quantita),
      OLD.quantita,
      NEW.quantita,
      'Modifica diretta inventario',
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_modifica_magazzino
AFTER UPDATE OF quantita ON public.magazzino
FOR EACH ROW
EXECUTE FUNCTION public.log_modifica_diretta_magazzino();

-- 6. Trigger per gestire assegnazioni
CREATE OR REPLACE FUNCTION public.gestisci_assegnazione_materiale()
RETURNS TRIGGER AS $$
DECLARE
  v_movimento_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nuova assegnazione
    v_movimento_id := public.registra_movimento_magazzino(
      NEW.materiale_id,
      'assegnazione',
      NEW.quantita,
      'Assegnazione materiale a squadra',
      NEW.squadra_id,
      NEW.note
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.stato = 'restituita' AND OLD.stato != 'restituita' THEN
    -- Restituzione
    v_movimento_id := public.registra_movimento_magazzino(
      NEW.materiale_id,
      'restituzione',
      COALESCE(NEW.quantita_restituita, NEW.quantita),
      'Restituzione materiale da squadra',
      NEW.squadra_id,
      NEW.note
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_assegnazione_materiale
BEFORE INSERT OR UPDATE ON public.assegnazioni_materiale
FOR EACH ROW
EXECUTE FUNCTION public.gestisci_assegnazione_materiale();

-- 7. View per riepilogo magazzino con movimenti
CREATE OR REPLACE VIEW public.v_magazzino_dettaglio AS
SELECT 
  m.*,
  COALESCE(
    (SELECT SUM(am.quantita) 
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = m.id 
     AND am.stato = 'attiva'),
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
        'squadra_id', s.id,
        'squadra_nome', s.nome,
        'quantita', am.quantita,
        'data_assegnazione', am.data_assegnazione
      )
    )
    FROM public.assegnazioni_materiale am
    JOIN public.squadre s ON am.squadra_id = s.id
    WHERE am.materiale_id = m.id 
    AND am.stato = 'attiva'
  ) as assegnazioni_attive
FROM public.magazzino m;

-- 8. View per cronologia movimenti
CREATE OR REPLACE VIEW public.v_cronologia_movimenti AS
SELECT 
  mm.*,
  mag.nome_articolo,
  mag.tipo_materiale,
  mag.codice_tracking,
  u.nome || ' ' || u.cognome as utente_nome,
  s.nome as squadra_nome
FROM public.movimenti_magazzino mm
JOIN public.magazzino mag ON mm.materiale_id = mag.id
JOIN public.users u ON mm.utente_id = u.id
LEFT JOIN public.squadre s ON mm.squadra_id = s.id
ORDER BY mm.data_movimento DESC;

-- 9. Indici per performance
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_materiale ON public.movimenti_magazzino(materiale_id);
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_data ON public.movimenti_magazzino(data_movimento DESC);
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_tipo ON public.movimenti_magazzino(tipo_movimento);
CREATE INDEX IF NOT EXISTS idx_assegnazioni_materiale_stato ON public.assegnazioni_materiale(stato);
CREATE INDEX IF NOT EXISTS idx_magazzino_categoria ON public.magazzino(categoria);
CREATE INDEX IF NOT EXISTS idx_magazzino_stato ON public.magazzino(stato);

-- 10. RLS Policies
ALTER TABLE public.movimenti_magazzino ENABLE ROW LEVEL SECURITY;

-- Lettura per tutti gli utenti autenticati
CREATE POLICY "movimenti_magazzino_select_policy" ON public.movimenti_magazzino
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Inserimento solo per admin, dirigenti e allenatori
CREATE POLICY "movimenti_magazzino_insert_policy" ON public.movimenti_magazzino
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'dirigente', 'allenatore')
  )
);

-- Aggiorna policy magazzino per permettere update ad allenatori
DROP POLICY IF EXISTS "magazzino_update_policy" ON public.magazzino;
CREATE POLICY "magazzino_update_policy" ON public.magazzino
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'dirigente', 'allenatore')
  )
);

-- Aggiorna policy assegnazioni_materiale
DROP POLICY IF EXISTS "assegnazioni_materiale_insert_policy" ON public.assegnazioni_materiale;
CREATE POLICY "assegnazioni_materiale_insert_policy" ON public.assegnazioni_materiale
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'dirigente', 'allenatore')
  )
);

DROP POLICY IF EXISTS "assegnazioni_materiale_update_policy" ON public.assegnazioni_materiale;
CREATE POLICY "assegnazioni_materiale_update_policy" ON public.assegnazioni_materiale
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'dirigente', 'allenatore')
  )
);

-- 11. Funzione helper per inizializzare quantità
CREATE OR REPLACE FUNCTION public.inizializza_inventario_magazzino(
  p_materiale_id uuid,
  p_quantita_iniziale integer
)
RETURNS void AS $$
BEGIN
  -- Aggiorna quantità iniziale
  UPDATE public.magazzino
  SET quantita_iniziale = p_quantita_iniziale,
      quantita = p_quantita_iniziale
  WHERE id = p_materiale_id;

  -- Registra movimento iniziale
  INSERT INTO public.movimenti_magazzino (
    materiale_id,
    tipo_movimento,
    quantita,
    quantita_prima,
    quantita_dopo,
    causale,
    utente_id
  ) VALUES (
    p_materiale_id,
    'inventario_iniziale',
    p_quantita_iniziale,
    0,
    p_quantita_iniziale,
    'Inventario iniziale',
    auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti per documentazione
COMMENT ON TABLE public.movimenti_magazzino IS 'Cronologia di tutti i movimenti di magazzino';
COMMENT ON FUNCTION public.registra_movimento_magazzino IS 'Funzione per registrare movimenti di magazzino con controllo giacenze';
COMMENT ON VIEW public.v_magazzino_dettaglio IS 'Vista dettagliata articoli con quantità assegnate e disponibili';
COMMENT ON VIEW public.v_cronologia_movimenti IS 'Vista cronologica di tutti i movimenti con dettagli';