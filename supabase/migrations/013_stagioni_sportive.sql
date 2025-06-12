-- Create comprehensive season management system

-- Create stagioni_sportive table
CREATE TABLE public.stagioni_sportive (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome text NOT NULL UNIQUE, -- es. "2024/2025"
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  attiva boolean DEFAULT false, -- Solo una stagione può essere attiva
  archiviata boolean DEFAULT false,
  descrizione text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_date_logic CHECK (data_fine > data_inizio),
  CONSTRAINT check_single_active EXCLUDE (attiva WITH =) WHERE (attiva = true)
);

-- Create parametri_sistema table for global settings
CREATE TABLE public.parametri_sistema (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  chiave text NOT NULL UNIQUE,
  valore text,
  descrizione text,
  tipo text DEFAULT 'string', -- string, number, boolean, date
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default parameters
INSERT INTO public.parametri_sistema (chiave, valore, descrizione, tipo) VALUES
('stagione_corrente_id', NULL, 'ID della stagione sportiva corrente visualizzata nella dashboard', 'string'),
('nome_societa', 'Virpol Campogalliano', 'Nome della società sportiva', 'string'),
('anno_fondazione', '2009', 'Anno di fondazione della società', 'number'),
('sede_sociale', 'Campogalliano (MO)', 'Sede sociale della società', 'string'),
('email_principale', 'info@virpolcampogalliano.it', 'Email principale della società', 'string'),
('telefono_principale', '059 123456', 'Telefono principale della società', 'string');

-- Add stagione_id to existing tables that need seasonal data
-- NOTA: Modifichiamo solo le tabelle che hanno senso per stagione

-- Squadre - ogni stagione può avere squadre diverse
ALTER TABLE public.squadre 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Partite - sono specifiche per stagione
ALTER TABLE public.partite 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Tornei - possono essere specifici per stagione  
ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Presenze - sono specifiche per stagione
ALTER TABLE public.presenze 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Convocazioni - sono specifiche per stagione
ALTER TABLE public.convocazioni 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Report mensili - specifici per stagione
ALTER TABLE public.report_mensili 
ADD COLUMN IF NOT EXISTS stagione_id uuid REFERENCES public.stagioni_sportive(id);

-- Tesserati-Squadre relationship - serve una tabella di associazione per stagioni
CREATE TABLE public.tesserati_squadre_stagioni (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tesserato_id uuid REFERENCES public.tesserati(id) ON DELETE CASCADE NOT NULL,
  squadra_id uuid REFERENCES public.squadre(id) ON DELETE CASCADE NOT NULL,
  stagione_id uuid REFERENCES public.stagioni_sportive(id) ON DELETE CASCADE NOT NULL,
  ruolo_squadra text, -- può cambiare per stagione
  numero_maglia integer,
  data_tesseramento date,
  note text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tesserato_id, squadra_id, stagione_id),
  UNIQUE(squadra_id, numero_maglia, stagione_id) -- numero maglia unico per squadra/stagione
);

-- Le seguenti tabelle NON hanno stagione_id perché sono dati permanenti:
-- - tesserati (anagrafica sempre attiva)
-- - users (utenti sempre attivi) 
-- - avversari (anagrafica permanente)
-- - categorie_avversari (categorie permanenti)
-- - campi (strutture permanenti)
-- - magazzino (inventario permanente)
-- - eventi_economici e movimenti_economici (contabilità permanente)

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_squadre_stagione ON public.squadre(stagione_id);
CREATE INDEX IF NOT EXISTS idx_partite_stagione ON public.partite(stagione_id);
CREATE INDEX IF NOT EXISTS idx_tornei_stagione ON public.tornei(stagione_id);
CREATE INDEX IF NOT EXISTS idx_presenze_stagione ON public.presenze(stagione_id);
CREATE INDEX IF NOT EXISTS idx_tesserati_squadre_stagioni_lookup ON public.tesserati_squadre_stagioni(stagione_id, squadra_id);

-- Enable RLS on new tables
ALTER TABLE public.stagioni_sportive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametri_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tesserati_squadre_stagioni ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "stagioni_sportive_select_policy" ON public.stagioni_sportive FOR SELECT USING (true);
CREATE POLICY "stagioni_sportive_insert_policy" ON public.stagioni_sportive FOR INSERT WITH CHECK (true);
CREATE POLICY "stagioni_sportive_update_policy" ON public.stagioni_sportive FOR UPDATE USING (true);
CREATE POLICY "stagioni_sportive_delete_policy" ON public.stagioni_sportive FOR DELETE USING (true);

CREATE POLICY "parametri_sistema_select_policy" ON public.parametri_sistema FOR SELECT USING (true);
CREATE POLICY "parametri_sistema_insert_policy" ON public.parametri_sistema FOR INSERT WITH CHECK (true);
CREATE POLICY "parametri_sistema_update_policy" ON public.parametri_sistema FOR UPDATE USING (true);
CREATE POLICY "parametri_sistema_delete_policy" ON public.parametri_sistema FOR DELETE USING (true);

CREATE POLICY "tesserati_squadre_stagioni_select_policy" ON public.tesserati_squadre_stagioni FOR SELECT USING (true);
CREATE POLICY "tesserati_squadre_stagioni_insert_policy" ON public.tesserati_squadre_stagioni FOR INSERT WITH CHECK (true);
CREATE POLICY "tesserati_squadre_stagioni_update_policy" ON public.tesserati_squadre_stagioni FOR UPDATE USING (true);
CREATE POLICY "tesserati_squadre_stagioni_delete_policy" ON public.tesserati_squadre_stagioni FOR DELETE USING (true);

-- Insert a default current season (2024/2025)
INSERT INTO public.stagioni_sportive (nome, data_inizio, data_fine, attiva, descrizione) 
VALUES (
  '2024/2025', 
  '2024-09-01', 
  '2025-06-30', 
  true, 
  'Stagione sportiva 2024/2025 - Stagione corrente'
);

-- Update parametri_sistema with the current season ID
UPDATE public.parametri_sistema 
SET valore = (SELECT id FROM public.stagioni_sportive WHERE nome = '2024/2025')
WHERE chiave = 'stagione_corrente_id';