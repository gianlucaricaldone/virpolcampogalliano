-- Fix presenze delete policies to allow admin and dirigenti to delete

-- Drop existing policies for presenze
DROP POLICY IF EXISTS "Allenatori can manage presenze for their teams" ON public.presenze;
DROP POLICY IF EXISTS "Tesserati can view their own presenze" ON public.presenze;
DROP POLICY IF EXISTS "Admins and dirigenti can view all presenze" ON public.presenze;

-- Create new comprehensive policies for presenze

-- 1. View policy: everyone based on role
CREATE POLICY "presenze_select_policy" ON public.presenze
FOR SELECT USING (
  -- Admin e dirigenti vedono tutto
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
  OR
  -- Allenatori vedono presenze delle loro squadre
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'allenatore'
    AND (
      -- Controlla se la squadra della presenza è tra quelle dell'allenatore
      presenze.squadra_id = ANY(u.squadra_id)
      OR
      -- Fallback: controlla tramite tesserati_squadre_stagioni
      EXISTS (
        SELECT 1 FROM public.tesserati_squadre_stagioni tss
        WHERE tss.tesserato_id = presenze.tesserato_id
        AND tss.stagione_id = presenze.stagione_id
        AND tss.squadra_id = ANY(u.squadra_id)
      )
    )
  )
  OR
  -- Tesserati vedono le proprie presenze
  EXISTS (
    SELECT 1 FROM public.tesserati t
    JOIN public.users u ON u.email = t.email
    WHERE u.id = auth.uid() 
    AND t.id = presenze.tesserato_id
  )
);

-- 2. Insert policy
CREATE POLICY "presenze_insert_policy" ON public.presenze
FOR INSERT WITH CHECK (
  -- Admin e dirigenti possono inserire tutto
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
  OR
  -- Allenatori possono inserire per le loro squadre
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'allenatore'
    AND presenze.squadra_id = ANY(u.squadra_id)
  )
);

-- 3. Update policy
CREATE POLICY "presenze_update_policy" ON public.presenze
FOR UPDATE USING (
  -- Admin e dirigenti possono modificare tutto
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
  OR
  -- Allenatori possono modificare presenze delle loro squadre
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'allenatore'
    AND (
      presenze.squadra_id = ANY(u.squadra_id)
      OR
      EXISTS (
        SELECT 1 FROM public.tesserati_squadre_stagioni tss
        WHERE tss.tesserato_id = presenze.tesserato_id
        AND tss.stagione_id = presenze.stagione_id
        AND tss.squadra_id = ANY(u.squadra_id)
      )
    )
  )
);

-- 4. Delete policy - QUESTA È LA POLICY MANCANTE!
CREATE POLICY "presenze_delete_policy" ON public.presenze
FOR DELETE USING (
  -- Admin e dirigenti possono eliminare tutto
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
  OR
  -- Allenatori possono eliminare presenze delle loro squadre
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'allenatore'
    AND (
      presenze.squadra_id = ANY(u.squadra_id)
      OR
      EXISTS (
        SELECT 1 FROM public.tesserati_squadre_stagioni tss
        WHERE tss.tesserato_id = presenze.tesserato_id
        AND tss.stagione_id = presenze.stagione_id
        AND tss.squadra_id = ANY(u.squadra_id)
      )
    )
  )
);

-- Aggiungi indice per migliorare performance delle policy
CREATE INDEX IF NOT EXISTS idx_presenze_squadra_stagione 
ON public.presenze(squadra_id, stagione_id);

-- Aggiungi commento per documentazione
COMMENT ON POLICY "presenze_delete_policy" ON public.presenze IS 
'Permette ad admin, dirigenti e allenatori di eliminare presenze. Gli allenatori possono eliminare solo presenze delle loro squadre.';