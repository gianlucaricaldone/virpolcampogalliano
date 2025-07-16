-- Migration 034: Fix partite organization_id issue
-- This migration adds the auto-assignment trigger for partite and ensures proper organization_id handling

-- Add trigger to auto-assign organization_id on partite insert
DROP TRIGGER IF EXISTS partite_auto_assign_organization_id ON partite;
CREATE TRIGGER partite_auto_assign_organization_id
    BEFORE INSERT ON partite
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

-- Also add trigger for avversari and categorie_avversari to ensure consistency
DROP TRIGGER IF EXISTS avversari_auto_assign_organization_id ON avversari;
CREATE TRIGGER avversari_auto_assign_organization_id
    BEFORE INSERT ON avversari
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

DROP TRIGGER IF EXISTS categorie_avversari_auto_assign_organization_id ON categorie_avversari;
CREATE TRIGGER categorie_avversari_auto_assign_organization_id
    BEFORE INSERT ON categorie_avversari
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

-- Ensure all existing partite have organization_id set
UPDATE partite 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

-- Ensure all existing avversari have organization_id set
UPDATE avversari 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

-- Ensure all existing categorie_avversari have organization_id set
UPDATE categorie_avversari 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

-- Log completion
INSERT INTO parametri_sistema (
  organization_id,
  chiave,
  valore,
  descrizione,
  created_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
  'migration_034_completed',
  to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  'Fixed partite organization_id auto-assignment',
  NOW()
) ON CONFLICT (organization_id, chiave) DO UPDATE SET
  valore = EXCLUDED.valore,
  updated_at = NOW();