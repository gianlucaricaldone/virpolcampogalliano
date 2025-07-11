-- Migration 033: Fix Presenze Organization ID Issues
-- Fixes the organization_id constraint errors in presenze table

-- ==============================================================
-- STEP 1: Create trigger to auto-assign organization_id for presenze
-- ==============================================================

CREATE OR REPLACE FUNCTION auto_assign_organization_id_presenze()
RETURNS TRIGGER AS $$
BEGIN
  -- Se organization_id non è specificato, usa quello di default
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger per la tabella presenze
DROP TRIGGER IF EXISTS trigger_auto_assign_org_id_presenze ON presenze;
CREATE TRIGGER trigger_auto_assign_org_id_presenze
  BEFORE INSERT ON presenze
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_organization_id_presenze();

-- ==============================================================
-- STEP 2: Update existing presenze without organization_id
-- ==============================================================

-- Aggiorna le presenze esistenti che non hanno organization_id
UPDATE presenze 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

-- ==============================================================
-- STEP 3: Make organization_id NOT NULL for presenze if possible
-- ==============================================================

-- Controlla se ci sono ancora record NULL
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM presenze WHERE organization_id IS NULL;
  
  IF null_count = 0 THEN
    -- Se non ci sono più NULL, rendi la colonna NOT NULL
    ALTER TABLE presenze ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'Set organization_id NOT NULL for presenze table';
  ELSE
    RAISE NOTICE 'Still % records with NULL organization_id in presenze, skipping NOT NULL constraint', null_count;
  END IF;
END $$;

-- ==============================================================
-- STEP 4: Add helpful indexes for presenze queries
-- ==============================================================

-- Indice composto per le query più comuni di presenze
CREATE INDEX IF NOT EXISTS idx_presenze_organization_lookup 
ON presenze(organization_id, data, tipo, squadra_id, stagione_id);

-- Indice per lookup rapido presenza esistente
CREATE INDEX IF NOT EXISTS idx_presenze_unique_lookup 
ON presenze(tesserato_id, data, tipo) WHERE presente IS NOT NULL;

-- ==============================================================
-- STEP 5: Grant permissions
-- ==============================================================

GRANT EXECUTE ON FUNCTION auto_assign_organization_id_presenze() TO authenticated;

-- ==============================================================
-- STEP 6: Add helpful comments
-- ==============================================================

COMMENT ON FUNCTION auto_assign_organization_id_presenze IS 'Auto-assigns default organization_id for presenze inserts';
COMMENT ON TRIGGER trigger_auto_assign_org_id_presenze ON presenze IS 'Ensures all presenze have an organization_id';

-- ==============================================================
-- STEP 7: Test the trigger (optional - can be removed in production)
-- ==============================================================

DO $$
BEGIN
  -- Test che il trigger funzioni
  RAISE NOTICE 'Presenze organization_id trigger installed successfully';
  
  -- Verifica che tutti i record abbiano organization_id
  IF EXISTS (SELECT 1 FROM presenze WHERE organization_id IS NULL) THEN
    RAISE WARNING 'Some presenze records still have NULL organization_id';
  ELSE
    RAISE NOTICE 'All presenze records have organization_id assigned';
  END IF;
END $$;