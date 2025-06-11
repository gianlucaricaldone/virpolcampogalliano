-- Creazione tabella report_mensili per i report mensili degli allenatori
CREATE TABLE IF NOT EXISTS public.report_mensili (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    allenatore_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    squadra_id uuid REFERENCES public.squadre(id) ON DELETE CASCADE,
    mese integer NOT NULL CHECK (mese >= 1 AND mese <= 12),
    anno integer NOT NULL CHECK (anno >= 2020 AND anno <= 2030),
    report text NOT NULL,
    stato text NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'inviato')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    -- Constraint per evitare duplicati dello stesso report mensile per allenatore/squadra/mese/anno
    UNIQUE(allenatore_id, squadra_id, mese, anno)
);

-- Abilitazione RLS
ALTER TABLE public.report_mensili ENABLE ROW LEVEL SECURITY;

-- Policy per permettere agli utenti di vedere solo i propri report o agli admin/dirigenti di vedere tutti
CREATE POLICY "Users can view own reports or admins/dirigenti can view all"
    ON public.report_mensili FOR SELECT
    USING (
        allenatore_id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                role = 'admin' 
                OR role = 'dirigente'
                OR (roles IS NOT NULL AND ('admin' = ANY(roles) OR 'dirigente' = ANY(roles)))
            )
        )
    );

-- Policy per permettere agli allenatori di inserire i propri report
CREATE POLICY "Allenatori can insert own reports"
    ON public.report_mensili FOR INSERT
    WITH CHECK (
        allenatore_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                role = 'allenatore' 
                OR role = 'admin' 
                OR role = 'dirigente'
                OR (roles IS NOT NULL AND ('allenatore' = ANY(roles) OR 'admin' = ANY(roles) OR 'dirigente' = ANY(roles)))
            )
        )
    );

-- Policy per permettere agli allenatori di aggiornare i propri report o agli admin/dirigenti di aggiornare tutti
CREATE POLICY "Users can update own reports or admins/dirigenti can update all"
    ON public.report_mensili FOR UPDATE
    USING (
        allenatore_id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                role = 'admin' 
                OR role = 'dirigente'
                OR (roles IS NOT NULL AND ('admin' = ANY(roles) OR 'dirigente' = ANY(roles)))
            )
        )
    );

-- Policy per permettere agli allenatori di eliminare i propri report o agli admin/dirigenti di eliminare tutti
CREATE POLICY "Users can delete own reports or admins/dirigenti can delete all"
    ON public.report_mensili FOR DELETE
    USING (
        allenatore_id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                role = 'admin' 
                OR role = 'dirigente'
                OR (roles IS NOT NULL AND ('admin' = ANY(roles) OR 'dirigente' = ANY(roles)))
            )
        )
    );

-- Trigger per aggiornare automaticamente il campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_report_mensili_updated_at
    BEFORE UPDATE ON public.report_mensili
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_report_mensili_allenatore_id ON public.report_mensili(allenatore_id);
CREATE INDEX IF NOT EXISTS idx_report_mensili_squadra_id ON public.report_mensili(squadra_id);
CREATE INDEX IF NOT EXISTS idx_report_mensili_mese_anno ON public.report_mensili(mese, anno);
CREATE INDEX IF NOT EXISTS idx_report_mensili_created_at ON public.report_mensili(created_at DESC);