-- Improve economic management structure with categories and better data model

-- Drop existing tables if they exist (carefully)
DROP TABLE IF EXISTS public.movimenti_economici CASCADE;
DROP TABLE IF EXISTS public.eventi_economici CASCADE;

-- Create enhanced movimenti_economici table (standalone, not dependent on eventi)
CREATE TABLE public.movimenti_economici (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('entrata', 'uscita')),
  categoria text NOT NULL,
  sottocategoria text,
  importo decimal(10,2) NOT NULL CHECK (importo > 0),
  descrizione text NOT NULL,
  data_movimento date NOT NULL,
  metodo_pagamento text DEFAULT 'contanti', -- contanti, bonifico, carta, altro
  riferimento text, -- numero fattura, ricevuta, etc.
  note text,
  
  -- Relations
  tesserato_id uuid REFERENCES public.tesserati(id) ON DELETE SET NULL, -- for quota payments
  evento_id uuid REFERENCES public.eventi(id) ON DELETE SET NULL, -- for event income
  stagione_id uuid REFERENCES public.stagioni_sportive(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categorie_economiche table for predefined categories
CREATE TABLE public.categorie_economiche (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('entrata', 'uscita', 'entrambi')),
  descrizione text,
  colore text DEFAULT '#6b7280', -- hex color for charts
  attiva boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default categories
INSERT INTO public.categorie_economiche (nome, tipo, descrizione, colore) VALUES
-- Entrate
('Quote Tesseramento', 'entrata', 'Pagamenti quote stagionali dei tesserati', '#22c55e'),
('Eventi Sociali', 'entrata', 'Incassi da cene sociali e eventi', '#3b82f6'),
('Sponsorizzazioni', 'entrata', 'Contributi da sponsor e partner', '#8b5cf6'),
('Tornei', 'entrata', 'Iscrizioni e premi da tornei', '#f59e0b'),
('Vendita Materiale', 'entrata', 'Vendita di divise, gadget, etc.', '#06b6d4'),
('Contributi Istituzionali', 'entrata', 'Contributi da federazioni, comune, etc.', '#84cc16'),
('Altro Entrate', 'entrata', 'Altre entrate non categorizzate', '#6b7280'),

-- Uscite  
('Materiale Sportivo', 'uscita', 'Acquisto palloni, divise, attrezzature', '#ef4444'),
('Spese Strutture', 'uscita', 'Affitti campi, manutenzione, utenze', '#f97316'),
('Trasporti', 'uscita', 'Pullman, rimborsi trasferte', '#eab308'),
('Arbitri e Ufficiali', 'uscita', 'Pagamenti arbitri e commissari', '#a855f7'),
('Assicurazioni', 'uscita', 'Polizze assicurative', '#ec4899'),
('Tesseramenti Federali', 'uscita', 'Tasse federazione, tesserini', '#6366f1'),
('Eventi e Catering', 'uscita', 'Spese per organizzazione eventi', '#14b8a6'),
('Spese Amministrative', 'uscita', 'Commercialista, cancelleria, etc.', '#64748b'),
('Altro Uscite', 'uscita', 'Altre uscite non categorizzate', '#6b7280');

-- Create indexes for better performance
CREATE INDEX idx_movimenti_economici_data ON public.movimenti_economici(data_movimento);
CREATE INDEX idx_movimenti_economici_tipo ON public.movimenti_economici(tipo);
CREATE INDEX idx_movimenti_economici_categoria ON public.movimenti_economici(categoria);
CREATE INDEX idx_movimenti_economici_stagione ON public.movimenti_economici(stagione_id);
CREATE INDEX idx_movimenti_economici_tesserato ON public.movimenti_economici(tesserato_id);

-- Enable RLS
ALTER TABLE public.movimenti_economici ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorie_economiche ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin only for both tables
CREATE POLICY "movimenti_economici_admin_only" ON public.movimenti_economici
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "categorie_economiche_admin_only" ON public.categorie_economiche
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Add triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.movimenti_economici
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.categorie_economiche
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create view for economic dashboard stats
CREATE VIEW public.v_economia_stats AS
SELECT 
  stagione_id,
  tipo,
  categoria,
  SUM(importo) as totale,
  COUNT(*) as numero_movimenti,
  AVG(importo) as importo_medio,
  MIN(data_movimento) as data_primo_movimento,
  MAX(data_movimento) as data_ultimo_movimento
FROM public.movimenti_economici
GROUP BY stagione_id, tipo, categoria;

-- Grant permissions
GRANT SELECT ON public.v_economia_stats TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.movimenti_economici IS 'Movimenti economici (entrate/uscite) della società sportiva';
COMMENT ON TABLE public.categorie_economiche IS 'Categorie predefinite per classificare i movimenti economici';
COMMENT ON VIEW public.v_economia_stats IS 'Statistiche aggregate per dashboard economia';

-- Add function to automatically link tesserato payments
CREATE OR REPLACE FUNCTION link_payment_to_tesserato(
  p_movimento_id uuid,
  p_tesserato_cognome text,
  p_tesserato_nome text DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_tesserato_id uuid;
BEGIN
  -- Try to find tesserato by cognome (and nome if provided)
  IF p_tesserato_nome IS NOT NULL THEN
    SELECT id INTO v_tesserato_id 
    FROM public.tesserati 
    WHERE lower(cognome) = lower(p_tesserato_cognome) 
    AND lower(nome) = lower(p_tesserato_nome)
    AND stato = true
    LIMIT 1;
  ELSE
    SELECT id INTO v_tesserato_id 
    FROM public.tesserati 
    WHERE lower(cognome) = lower(p_tesserato_cognome)
    AND stato = true
    LIMIT 1;
  END IF;

  -- Update movimento if tesserato found
  IF v_tesserato_id IS NOT NULL THEN
    UPDATE public.movimenti_economici 
    SET tesserato_id = v_tesserato_id
    WHERE id = p_movimento_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;