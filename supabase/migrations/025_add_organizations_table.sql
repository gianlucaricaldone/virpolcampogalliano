-- Migration 025: Add Organizations Table for Multi-Tenant Support
-- This migration creates the foundation for multi-organization support

-- Tabella principale per le organizzazioni
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  secondary_color VARCHAR(7) DEFAULT '#1e40af',
  
  -- Subscription info
  subscription_plan VARCHAR(20) DEFAULT 'base' CHECK (subscription_plan IN ('base', 'plus', 'enterprise', 'trial')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended', 'cancelled')),
  subscription_started_at TIMESTAMP DEFAULT NOW(),
  subscription_expires_at TIMESTAMP,
  trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days'),
  
  -- Limiti del piano
  max_tesserati INTEGER DEFAULT 100,
  max_squadre INTEGER DEFAULT 10,
  max_storage_gb INTEGER DEFAULT 5,
  
  -- Features flags
  features JSONB DEFAULT '{
    "sms": true,
    "email": true,
    "export": true,
    "api_access": false,
    "custom_domain": false,
    "white_label": false
  }'::jsonb,
  
  -- Metadata
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Soft delete
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Indici per performance
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_status ON organizations(subscription_status) WHERE is_active = true;
CREATE INDEX idx_organizations_expires ON organizations(subscription_expires_at) WHERE subscription_status = 'active';

-- Trigger per updated_at
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Tabella per membri dell'organizzazione
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Aggiungi constraint di unicità se non esiste
ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_org_user_unique 
UNIQUE (organization_id, user_id);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, role);

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for organizations table
CREATE POLICY organizations_select ON organizations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY organizations_update ON organizations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organizations.id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- RLS policies for organization_members table
CREATE POLICY org_members_select ON organization_members
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY org_members_insert ON organization_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organization_members.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY org_members_update ON organization_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
);

CREATE POLICY org_members_delete ON organization_members
FOR DELETE USING (
  user_id = auth.uid() OR -- User can remove themselves
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
);