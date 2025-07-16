-- Migration 035: Create auto_assign_organization_id function and triggers
-- This migration creates the missing function and applies triggers

-- Create the auto_assign_organization_id function
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If organization_id is not specified, use the default organization
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to auto-assign organization_id on partite insert
DROP TRIGGER IF EXISTS partite_auto_assign_organization_id ON partite;
CREATE TRIGGER partite_auto_assign_organization_id
    BEFORE INSERT ON partite
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

-- Add trigger for avversari
DROP TRIGGER IF EXISTS avversari_auto_assign_organization_id ON avversari;
CREATE TRIGGER avversari_auto_assign_organization_id
    BEFORE INSERT ON avversari
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

-- Add trigger for categorie_avversari
DROP TRIGGER IF EXISTS categorie_avversari_auto_assign_organization_id ON categorie_avversari;
CREATE TRIGGER categorie_avversari_auto_assign_organization_id
    BEFORE INSERT ON categorie_avversari
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_organization_id();

-- Ensure all existing records have organization_id set
UPDATE partite 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

UPDATE avversari 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;

UPDATE categorie_avversari 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
WHERE organization_id IS NULL;