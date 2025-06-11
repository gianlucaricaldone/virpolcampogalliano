-- Aggiorna l'enum tipo_presenza per includere torneo ed evento
ALTER TYPE tipo_presenza ADD VALUE IF NOT EXISTS 'torneo';
ALTER TYPE tipo_presenza ADD VALUE IF NOT EXISTS 'evento';

-- Crea tabella per i report degli allenatori
CREATE TABLE IF NOT EXISTS public.report_allenatori (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    allenatore_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    squadra_id uuid REFERENCES public.squadre(id) ON DELETE CASCADE,
    data date NOT NULL DEFAULT CURRENT_DATE,
    tipo_attivita tipo_presenza NOT NULL,
    report text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_report_allenatori_data ON public.report_allenatori(data);
CREATE INDEX IF NOT EXISTS idx_report_allenatori_squadra ON public.report_allenatori(squadra_id);
CREATE INDEX IF NOT EXISTS idx_report_allenatori_allenatore ON public.report_allenatori(allenatore_id);

-- Aggiungi RLS policies per report_allenatori
ALTER TABLE public.report_allenatori ENABLE ROW LEVEL SECURITY;

-- Policy per lettura: admin e dirigenti possono vedere tutti i report, allenatori solo i propri
CREATE POLICY "report_allenatori_select" ON public.report_allenatori
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role IN ('admin', 'dirigente')
        )
        OR auth.uid() = allenatore_id
    );

-- Policy per inserimento: solo allenatori possono creare report
CREATE POLICY "report_allenatori_insert" ON public.report_allenatori
    FOR INSERT WITH CHECK (
        auth.uid() = allenatore_id
        AND auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role IN ('admin', 'dirigente', 'allenatore')
        )
    );

-- Policy per aggiornamento: solo l'allenatore autore può modificare
CREATE POLICY "report_allenatori_update" ON public.report_allenatori
    FOR UPDATE USING (
        auth.uid() = allenatore_id
    );

-- Policy per cancellazione: solo admin
CREATE POLICY "report_allenatori_delete" ON public.report_allenatori
    FOR DELETE USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'admin'
        )
    );

-- Aggiungi campo squadra_id alla tabella presenze per filtraggio più efficiente
ALTER TABLE public.presenze 
ADD COLUMN IF NOT EXISTS squadra_id uuid REFERENCES public.squadre(id) ON DELETE SET NULL;

-- Crea una vista per statistiche presenze aggregate
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

-- Grant access to the view
GRANT SELECT ON public.statistiche_presenze TO authenticated;

-- Aggiungi trigger per aggiornare updated_at su report_allenatori
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.report_allenatori
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();