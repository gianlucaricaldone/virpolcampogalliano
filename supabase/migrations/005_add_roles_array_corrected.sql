-- Migrazione per aggiungere il campo roles come array alla tabella users esistente

-- 1. Aggiungi il campo roles come array di user_role
ALTER TABLE public.users 
ADD COLUMN roles user_role[] DEFAULT ARRAY['tesserato']::user_role[];

-- 2. Migra i dati esistenti: copia il valore del campo role nel nuovo array roles
UPDATE public.users 
SET roles = ARRAY[role]::user_role[] 
WHERE role IS NOT NULL;

-- 3. Assicurati che tutti gli utenti abbiano almeno un ruolo
UPDATE public.users 
SET roles = ARRAY['tesserato']::user_role[] 
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

-- 4. Aggiorna il trigger di creazione utente per includere roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role, roles)
  VALUES (new.id, new.email, 'tesserato', ARRAY['tesserato']::user_role[]);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crea funzioni helper per verificare i ruoli
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, check_role user_role)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.users 
        WHERE id = user_id 
        AND (
            check_role = ANY(roles) 
            OR (roles IS NULL AND role = check_role)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_has_any_role(user_id uuid, check_roles user_role[])
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.users 
        WHERE id = user_id 
        AND (
            roles && check_roles 
            OR (roles IS NULL AND role = ANY(check_roles))
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Aggiorna le RLS policies per utilizzare la nuova logica dei ruoli
-- Users table policies
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
    FOR SELECT USING (
        auth.uid() = id 
        OR public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
    );

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
    FOR UPDATE USING (
        auth.uid() = id 
        OR public.user_has_role(auth.uid(), 'admin')
    );

-- Squadre policies
DROP POLICY IF EXISTS "squadre_insert" ON public.squadre;
CREATE POLICY "squadre_insert" ON public.squadre
    FOR INSERT WITH CHECK (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
    );

DROP POLICY IF EXISTS "squadre_update" ON public.squadre;
CREATE POLICY "squadre_update" ON public.squadre
    FOR UPDATE USING (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
    );

DROP POLICY IF EXISTS "squadre_delete" ON public.squadre;
CREATE POLICY "squadre_delete" ON public.squadre
    FOR DELETE USING (
        public.user_has_role(auth.uid(), 'admin')
    );

-- Tesserati policies
DROP POLICY IF EXISTS "tesserati_select" ON public.tesserati;
CREATE POLICY "tesserati_select" ON public.tesserati
    FOR SELECT USING (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente', 'allenatore']::user_role[])
        OR auth.uid() IN (
            SELECT id FROM public.users 
            WHERE email = tesserati.email
        )
    );

DROP POLICY IF EXISTS "tesserati_insert" ON public.tesserati;
CREATE POLICY "tesserati_insert" ON public.tesserati
    FOR INSERT WITH CHECK (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
    );

DROP POLICY IF EXISTS "tesserati_update" ON public.tesserati;
CREATE POLICY "tesserati_update" ON public.tesserati
    FOR UPDATE USING (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
    );

DROP POLICY IF EXISTS "tesserati_delete" ON public.tesserati;
CREATE POLICY "tesserati_delete" ON public.tesserati
    FOR DELETE USING (
        public.user_has_role(auth.uid(), 'admin')
    );

-- Presenze policies
DROP POLICY IF EXISTS "presenze_select" ON public.presenze;
CREATE POLICY "presenze_select" ON public.presenze
    FOR SELECT USING (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente', 'allenatore']::user_role[])
        OR auth.uid() IN (
            SELECT u.id FROM public.users u
            JOIN public.tesserati t ON t.email = u.email
            WHERE t.id = presenze.tesserato_id
        )
    );

DROP POLICY IF EXISTS "presenze_insert" ON public.presenze;
CREATE POLICY "presenze_insert" ON public.presenze
    FOR INSERT WITH CHECK (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente', 'allenatore']::user_role[])
    );

DROP POLICY IF EXISTS "presenze_update" ON public.presenze;
CREATE POLICY "presenze_update" ON public.presenze
    FOR UPDATE USING (
        public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente', 'allenatore']::user_role[])
    );

-- Report allenatori policies (se la tabella esiste)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'report_allenatori') THEN
        DROP POLICY IF EXISTS "report_allenatori_select" ON public.report_allenatori;
        CREATE POLICY "report_allenatori_select" ON public.report_allenatori
            FOR SELECT USING (
                public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente']::user_role[])
                OR auth.uid() = allenatore_id
            );

        DROP POLICY IF EXISTS "report_allenatori_insert" ON public.report_allenatori;
        CREATE POLICY "report_allenatori_insert" ON public.report_allenatori
            FOR INSERT WITH CHECK (
                auth.uid() = allenatore_id
                AND public.user_has_any_role(auth.uid(), ARRAY['admin', 'dirigente', 'allenatore']::user_role[])
            );
    END IF;
END $$;

-- 7. Crea una vista per statistiche presenze con nuova logica ruoli (se non esiste già)
CREATE OR REPLACE VIEW public.statistiche_presenze AS
SELECT 
    t.squadra_id,
    s.nome as squadra_nome,
    p.tesserato_id,
    t.nome || ' ' || t.cognome as tesserato_nome,
    DATE_TRUNC('week', p.data) as settimana,
    DATE_TRUNC('month', p.data) as mese,
    p.tipo,
    COUNT(CASE WHEN p.presente THEN 1 END) as presenze,
    COUNT(*) as totale,
    ROUND(COUNT(CASE WHEN p.presente THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as percentuale
FROM public.presenze p
JOIN public.tesserati t ON p.tesserato_id = t.id
LEFT JOIN public.squadre s ON t.squadra_id = s.id
GROUP BY t.squadra_id, s.nome, p.tesserato_id, t.nome, t.cognome, 
         DATE_TRUNC('week', p.data), DATE_TRUNC('month', p.data), p.tipo;

-- Assicurati che la vista sia accessibile
GRANT SELECT ON public.statistiche_presenze TO authenticated;