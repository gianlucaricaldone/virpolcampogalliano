-- Fix tesserati table constraints to make some fields nullable
-- These fields should be optional for better flexibility

-- Make codice_fiscale nullable
ALTER TABLE public.tesserati 
ALTER COLUMN codice_fiscale DROP NOT NULL;

-- Make ruolo_squadra nullable (if not already done)
ALTER TABLE public.tesserati 
ALTER COLUMN ruolo_squadra DROP NOT NULL;

-- Add comments to clarify optional fields
COMMENT ON COLUMN public.tesserati.codice_fiscale IS 'Codice fiscale del tesserato (opzionale)';
COMMENT ON COLUMN public.tesserati.ruolo_squadra IS 'Ruolo nella squadra (opzionale, gestito ora in tesserati_squadre_stagioni)';

-- Since codice_fiscale has a UNIQUE constraint, we need to handle NULL values properly
-- PostgreSQL treats multiple NULL values as distinct for UNIQUE constraints, which is what we want