-- Fix presenze squadra_id and stagione_id data consistency
-- Ensure all presenze have correct squadra_id and stagione_id

-- Update presenze without squadra_id from tesserati_squadre_stagioni relationship
UPDATE public.presenze 
SET squadra_id = tss.squadra_id
FROM public.tesserati_squadre_stagioni tss
WHERE presenze.tesserato_id = tss.tesserato_id
  AND presenze.squadra_id IS NULL
  AND tss.stagione_id = presenze.stagione_id;

-- Update presenze without stagione_id to current active season
UPDATE public.presenze 
SET stagione_id = (
  SELECT id FROM public.stagioni_sportive 
  WHERE attiva = true 
  LIMIT 1
)
WHERE stagione_id IS NULL;

-- Create index for better performance on presenze queries
CREATE INDEX IF NOT EXISTS idx_presenze_data_tipo_squadra_stagione 
ON public.presenze(data, tipo, squadra_id, stagione_id);

-- Analyze table after updates
ANALYZE public.presenze;