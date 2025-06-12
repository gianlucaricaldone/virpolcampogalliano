-- Update tornei table: add visibility and registration flags

-- Add flags for managing tournament visibility and registrations
ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS attivo boolean DEFAULT true;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS iscrizioni_aperte boolean DEFAULT false;

-- Add additional fields for better tournament management
ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS descrizione text;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS immagine_copertina text;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS numero_squadre_max integer;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS numero_squadre_iscritte integer DEFAULT 0;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS luogo text;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS contatto_email text;

ALTER TABLE public.tornei 
ADD COLUMN IF NOT EXISTS contatto_telefono text;

-- Add check constraint to ensure logical data
ALTER TABLE public.tornei 
ADD CONSTRAINT check_date_logic CHECK (data_fine >= data_inizio);

-- Create index for better query performance on landing page
CREATE INDEX IF NOT EXISTS idx_tornei_active_visible ON public.tornei(attivo, iscrizioni_aperte) WHERE attivo = true;