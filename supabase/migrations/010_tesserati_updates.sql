-- Update tesserati table: make ruolo_squadra nullable, add codice_cartellino and visita_sportiva

-- Make ruolo_squadra nullable
ALTER TABLE public.tesserati 
ALTER COLUMN ruolo_squadra DROP NOT NULL;

-- Add codice_cartellino column
ALTER TABLE public.tesserati 
ADD COLUMN IF NOT EXISTS codice_cartellino text;

-- Add visita_sportiva column (boolean with default false)
ALTER TABLE public.tesserati 
ADD COLUMN IF NOT EXISTS visita_sportiva boolean DEFAULT false;

-- Update existing records to have null ruolo_squadra if needed
-- (This is optional, depending on your needs)