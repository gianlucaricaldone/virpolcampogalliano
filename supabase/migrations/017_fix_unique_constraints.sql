-- Fix per constraint di unicità mancanti

-- Rimuovi eventuali duplicati da tesserati_squadre_stagioni
-- (mantieni solo il più recente per ogni combinazione tesserato_id + stagione_id)
DELETE FROM public.tesserati_squadre_stagioni 
WHERE id NOT IN (
  SELECT DISTINCT ON (tesserato_id, stagione_id) id
  FROM public.tesserati_squadre_stagioni
  ORDER BY tesserato_id, stagione_id, created_at DESC
);

-- Rimuovi eventuali duplicati da tesserati_dati_stagionali  
-- (mantieni solo il più recente per ogni combinazione tesserato_id + stagione_id)
DELETE FROM public.tesserati_dati_stagionali 
WHERE id NOT IN (
  SELECT DISTINCT ON (tesserato_id, stagione_id) id
  FROM public.tesserati_dati_stagionali
  ORDER BY tesserato_id, stagione_id, created_at DESC
);

-- Aggiungi constraint di unicità
ALTER TABLE public.tesserati_squadre_stagioni 
ADD CONSTRAINT tesserati_squadre_stagioni_unique 
UNIQUE (tesserato_id, stagione_id);

ALTER TABLE public.tesserati_dati_stagionali 
ADD CONSTRAINT tesserati_dati_stagionali_unique 
UNIQUE (tesserato_id, stagione_id);

-- Commento per future reference
COMMENT ON CONSTRAINT tesserati_squadre_stagioni_unique ON public.tesserati_squadre_stagioni 
IS 'Un tesserato può essere assegnato a una sola squadra per stagione';

COMMENT ON CONSTRAINT tesserati_dati_stagionali_unique ON public.tesserati_dati_stagionali 
IS 'Un tesserato può avere un solo record di dati stagionali per stagione';