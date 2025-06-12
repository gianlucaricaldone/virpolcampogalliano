-- Tabella per gli eventi
CREATE TABLE IF NOT EXISTS public.eventi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    descrizione TEXT,
    data_evento TIMESTAMP WITH TIME ZONE NOT NULL,
    luogo VARCHAR(255),
    costo_persona DECIMAL(10, 2),
    max_partecipanti INTEGER,
    note TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per le prenotazioni agli eventi
CREATE TABLE IF NOT EXISTS public.prenotazioni_eventi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
    nome_partecipante VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefono VARCHAR(20),
    note TEXT,
    confermato BOOLEAN DEFAULT FALSE,
    presente BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_eventi_data ON public.eventi(data_evento);
CREATE INDEX idx_prenotazioni_evento ON public.prenotazioni_eventi(evento_id);
CREATE INDEX idx_prenotazioni_confermato ON public.prenotazioni_eventi(confermato);

-- RLS Policies
ALTER TABLE public.eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prenotazioni_eventi ENABLE ROW LEVEL SECURITY;

-- Policy per eventi: tutti possono vedere, solo admin e dirigenti possono creare/modificare
CREATE POLICY "Eventi visibili a tutti gli utenti autenticati" ON public.eventi
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin e dirigenti possono creare eventi" ON public.eventi
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'dirigente')
        )
    );

CREATE POLICY "Admin e dirigenti possono modificare eventi" ON public.eventi
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'dirigente')
        )
    );

CREATE POLICY "Admin e dirigenti possono eliminare eventi" ON public.eventi
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'dirigente')
        )
    );

-- Policy per prenotazioni: tutti possono vedere e creare, admin e dirigenti possono modificare
CREATE POLICY "Prenotazioni visibili a tutti gli utenti autenticati" ON public.prenotazioni_eventi
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Tutti possono creare prenotazioni" ON public.prenotazioni_eventi
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin e dirigenti possono modificare prenotazioni" ON public.prenotazioni_eventi
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'dirigente')
        )
    );

CREATE POLICY "Admin e dirigenti possono eliminare prenotazioni" ON public.prenotazioni_eventi
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'dirigente')
        )
    );

-- Function per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers per updated_at
CREATE TRIGGER update_eventi_updated_at BEFORE UPDATE ON public.eventi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prenotazioni_eventi_updated_at BEFORE UPDATE ON public.prenotazioni_eventi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();