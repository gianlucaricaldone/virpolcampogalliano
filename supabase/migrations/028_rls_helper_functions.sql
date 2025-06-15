-- Migration 028: RLS Helper Functions for Multi-Tenant Support
-- This migration creates helper functions for Row Level Security policies

-- Funzione per ottenere l'organization corrente dal JWT o dal context
CREATE OR REPLACE FUNCTION auth.current_organization_id()
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Try to get from JWT claims first
  BEGIN
    org_id := COALESCE(
      current_setting('request.jwt.claims', true)::json->>'organization_id',
      auth.jwt()->>'organization_id'
    )::UUID;
    
    IF org_id IS NOT NULL THEN
      RETURN org_id;
    END IF;
  EXCEPTION 
    WHEN OTHERS THEN
      -- Fallback to other methods
      NULL;
  END;
  
  -- Try to get from request context (set by application)
  BEGIN
    org_id := current_setting('app.current_organization_id', true)::UUID;
    IF org_id IS NOT NULL THEN
      RETURN org_id;
    END IF;
  EXCEPTION 
    WHEN OTHERS THEN
      NULL;
  END;
  
  -- Fallback: get user's first organization
  SELECT om.organization_id INTO org_id
  FROM organization_members om
  WHERE om.user_id = auth.uid()
  ORDER BY om.joined_at ASC
  LIMIT 1;
  
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare membership in una specifica organization
CREATE OR REPLACE FUNCTION auth.is_organization_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere il ruolo dell'utente nell'organization
CREATE OR REPLACE FUNCTION auth.organization_role(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO user_role
  FROM organization_members 
  WHERE organization_id = org_id 
  AND user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare se l'utente ha un ruolo specifico nell'organization
CREATE OR REPLACE FUNCTION auth.has_organization_role(org_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.organization_role(org_id) = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare se l'utente ha uno dei ruoli admin/owner
CREATE OR REPLACE FUNCTION auth.is_organization_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.organization_role(org_id) IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare se l'utente è owner dell'organization
CREATE OR REPLACE FUNCTION auth.is_organization_owner(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.has_organization_role(org_id, 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere tutte le organizations dell'utente
CREATE OR REPLACE FUNCTION auth.user_organizations()
RETURNS TABLE(organization_id UUID, role TEXT) AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT om.organization_id, om.role
  FROM organization_members om
  WHERE om.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione di utilità per logging (per debug)
CREATE OR REPLACE FUNCTION auth.log_rls_context(table_name TEXT, operation TEXT)
RETURNS VOID AS $$
BEGIN
  -- Solo per debugging, può essere rimossa in produzione
  RAISE NOTICE 'RLS Check: table=%, operation=%, user=%, org=%', 
    table_name, 
    operation, 
    auth.uid(), 
    auth.current_organization_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare limiti di subscription
CREATE OR REPLACE FUNCTION auth.check_subscription_limit(org_id UUID, resource_type TEXT, current_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  org_record organizations;
BEGIN
  SELECT * INTO org_record
  FROM organizations
  WHERE id = org_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica status subscription
  IF org_record.subscription_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Verifica limiti specifici
  CASE resource_type
    WHEN 'tesserati' THEN
      RETURN current_count < org_record.max_tesserati;
    WHEN 'squadre' THEN
      RETURN current_count < org_record.max_squadre;
    ELSE
      RETURN TRUE; -- Default allow per risorse non specificate
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare feature flags
CREATE OR REPLACE FUNCTION auth.has_organization_feature(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  features_json JSONB;
BEGIN
  SELECT features INTO features_json
  FROM organizations
  WHERE id = org_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN COALESCE((features_json->>feature_name)::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function per auto-assegnare organization_id negli INSERT
CREATE OR REPLACE FUNCTION auto_assign_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se organization_id non è specificato, usa quello corrente
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := auth.current_organization_id();
  END IF;
  
  -- Verifica che l'utente abbia accesso all'organization
  IF NOT auth.is_organization_member(NEW.organization_id) THEN
    RAISE EXCEPTION 'Access denied: user is not a member of organization %', NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions sulle funzioni
GRANT EXECUTE ON FUNCTION auth.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_organization_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.organization_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_organization_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_organization_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_organization_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.check_subscription_limit(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_organization_feature(UUID, TEXT) TO authenticated;