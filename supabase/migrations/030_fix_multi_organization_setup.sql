-- Migration 030: Fix Multi-Organization Setup
-- Questo file sistema la configurazione multi-organization su una struttura esistente
-- dove le tabelle organizations e organization_id sono già state create

-- ==============================================================
-- STEP 1: Verifica e sistema la tabella organization_members
-- ==============================================================

-- Controlla se il constraint di unicità esiste, altrimenti lo crea
DO $$
BEGIN
  -- Verifica se il constraint esiste
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_members_org_user_unique'
    AND conrelid = 'organization_members'::regclass
  ) THEN
    -- Aggiungi il constraint di unicità
    ALTER TABLE organization_members 
    ADD CONSTRAINT organization_members_org_user_unique 
    UNIQUE (organization_id, user_id);
    
    RAISE NOTICE 'Added unique constraint to organization_members';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on organization_members';
  END IF;
END $$;

-- ==============================================================
-- STEP 2: Crea l'organizzazione di default se non esiste
-- ==============================================================

-- Verifica e crea constraint di unicità su slug se non esiste
DO $$
BEGIN
  -- Controlla se il constraint su slug esiste
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%slug%' 
    AND conrelid = 'organizations'::regclass
  ) THEN
    -- Aggiungi constraint di unicità su slug
    ALTER TABLE organizations 
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);
    
    RAISE NOTICE 'Added unique constraint on organizations.slug';
  ELSE
    RAISE NOTICE 'Unique constraint on slug already exists';
  END IF;
END $$;

-- Inserisci l'organizzazione di default usando un approccio più sicuro
DO $$
BEGIN
  -- Controlla se l'organizzazione esiste già
  IF NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE slug = 'virpol-campogalliano' OR id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID
  ) THEN
    INSERT INTO organizations (
      id,
      name,
      slug,
      subscription_plan,
      subscription_status,
      max_tesserati,
      max_squadre,
      max_storage_gb,
      features,
      created_at
    ) VALUES (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
      'Virpol Campogalliano',
      'virpol-campogalliano',
      'enterprise',
      'active',
      9999,
      999,
      100,
      '{
        "sms": true,
        "email": true,
        "export": true,
        "api_access": true,
        "custom_domain": true,
        "white_label": true
      }'::jsonb,
      NOW()
    );
    
    RAISE NOTICE 'Created default organization: Virpol Campogalliano';
  ELSE
    RAISE NOTICE 'Default organization already exists';
  END IF;
END $$;

-- ==============================================================
-- STEP 3: Migra tutti i dati esistenti all'organization di default
-- ==============================================================

-- Helper function per migrare le tabelle
CREATE OR REPLACE FUNCTION migrate_table_to_default_org_safe(p_table_name text)
RETURNS void AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Verifica che la tabella esista e abbia la colonna organization_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = p_table_name 
    AND c.column_name = 'organization_id'
    AND c.table_schema = 'public'
  ) THEN
    -- Aggiorna solo i record che non hanno organization_id
    EXECUTE format('
      UPDATE %I 
      SET organization_id = ''a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11''::UUID,
          migrated_at = NOW()
      WHERE organization_id IS NULL
    ', p_table_name) ;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Table %: migrated % records to default organization', p_table_name, updated_count;
  ELSE
    RAISE NOTICE 'Table % does not exist or does not have organization_id column', p_table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Migra tutte le tabelle possibili
SELECT migrate_table_to_default_org_safe('stagioni_sportive');
SELECT migrate_table_to_default_org_safe('users');
SELECT migrate_table_to_default_org_safe('tesserati');
SELECT migrate_table_to_default_org_safe('squadre');
SELECT migrate_table_to_default_org_safe('tesserati_squadre_stagioni');
SELECT migrate_table_to_default_org_safe('tesserati_dati_stagionali');
SELECT migrate_table_to_default_org_safe('presenze');
SELECT migrate_table_to_default_org_safe('partite');
SELECT migrate_table_to_default_org_safe('convocazioni');
SELECT migrate_table_to_default_org_safe('magazzino');
SELECT migrate_table_to_default_org_safe('movimenti_magazzino');
SELECT migrate_table_to_default_org_safe('assegnazioni_materiale');
SELECT migrate_table_to_default_org_safe('tornei');
SELECT migrate_table_to_default_org_safe('iscrizioni_torneo');
SELECT migrate_table_to_default_org_safe('eventi');
SELECT migrate_table_to_default_org_safe('prenotazioni_eventi');
SELECT migrate_table_to_default_org_safe('eventi_economici');
SELECT migrate_table_to_default_org_safe('movimenti_economici');
SELECT migrate_table_to_default_org_safe('campi');
SELECT migrate_table_to_default_org_safe('calendario_campi');
SELECT migrate_table_to_default_org_safe('avversari');
SELECT migrate_table_to_default_org_safe('categorie_avversari');
SELECT migrate_table_to_default_org_safe('parametri_sistema');

-- ==============================================================
-- STEP 4: Migra gli utenti come membri dell'organization
-- ==============================================================

-- Migra gli utenti esistenti come membri della default organization
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT 
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
  auth_users.id,
  CASE 
    WHEN users.role = 'admin' THEN 'owner'
    WHEN users.role = 'dirigente' THEN 'admin'
    ELSE 'member'
  END,
  NOW()
FROM auth.users auth_users
LEFT JOIN public.users users ON auth_users.id = users.id
LEFT JOIN organization_members existing_members ON (
  existing_members.organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID 
  AND existing_members.user_id = auth_users.id
)
WHERE auth_users.id IS NOT NULL 
AND existing_members.id IS NULL;

-- ==============================================================
-- STEP 5: Imposta organization_id come NOT NULL dove possibile
-- ==============================================================

-- Helper function per rendere organization_id NOT NULL
CREATE OR REPLACE FUNCTION make_organization_id_required_safe(p_table_name text)
RETURNS void AS $$
DECLARE
  null_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  -- Verifica che la tabella e colonna esistano
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = p_table_name 
    AND c.column_name = 'organization_id'
    AND c.table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Table % does not have organization_id column, skipping', p_table_name;
    RETURN;
  END IF;
  
  -- Conta i record con organization_id NULL
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id IS NULL', p_table_name) INTO null_count;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Table % still has % records with NULL organization_id, skipping NOT NULL constraint', p_table_name, null_count;
    RETURN;
  END IF;
  
  -- Verifica se la colonna è già NOT NULL
  SELECT c.is_nullable = 'NO' INTO constraint_exists
  FROM information_schema.columns c
  WHERE c.table_name = p_table_name 
  AND c.column_name = 'organization_id'
  AND c.table_schema = 'public';
  
  IF constraint_exists THEN
    RAISE NOTICE 'Table % organization_id is already NOT NULL', p_table_name;
    RETURN;
  END IF;
  
  -- Imposta NOT NULL
  EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', p_table_name);
  RAISE NOTICE 'Set organization_id NOT NULL for table %', p_table_name;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to set NOT NULL on table %: %', p_table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Applica NOT NULL alle tabelle principali
SELECT make_organization_id_required_safe('stagioni_sportive');
SELECT make_organization_id_required_safe('tesserati');
SELECT make_organization_id_required_safe('squadre');
SELECT make_organization_id_required_safe('presenze');
SELECT make_organization_id_required_safe('partite');
SELECT make_organization_id_required_safe('magazzino');
SELECT make_organization_id_required_safe('tornei');
SELECT make_organization_id_required_safe('eventi');
SELECT make_organization_id_required_safe('eventi_economici');
SELECT make_organization_id_required_safe('campi');

-- ==============================================================
-- STEP 6: Setup RLS Helper Functions (Schema public)
-- ==============================================================

-- Funzione per ottenere l'organization corrente
CREATE OR REPLACE FUNCTION current_organization_id()
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
      NULL;
  END;
  
  -- Try to get from request context
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

-- Funzione per verificare membership
CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID)
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

-- Funzione per ottenere il ruolo
CREATE OR REPLACE FUNCTION organization_role(org_id UUID)
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

-- Funzione per verificare se è admin
CREATE OR REPLACE FUNCTION is_organization_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN organization_role(org_id) IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare se è owner
CREATE OR REPLACE FUNCTION is_organization_owner(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN organization_role(org_id) = 'owner';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION organization_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_owner(UUID) TO authenticated;

-- ==============================================================
-- STEP 7: Apply RLS Policies
-- ==============================================================

-- Function per creare RLS policies su una tabella
CREATE OR REPLACE FUNCTION create_organization_rls_policies_safe(p_table_name text)
RETURNS void AS $$
BEGIN
  -- Verifica che la tabella esista e abbia organization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = p_table_name 
    AND c.column_name = 'organization_id'
    AND c.table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Table % does not exist or does not have organization_id, skipping RLS', p_table_name;
    RETURN;
  END IF;
  
  -- Drop existing policies
  EXECUTE format('DROP POLICY IF EXISTS %I_org_select ON %I', p_table_name, p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_insert ON %I', p_table_name, p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_update ON %I', p_table_name, p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_delete ON %I', p_table_name, p_table_name);
  
  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  
  -- Create SELECT policy
  EXECUTE format('
    CREATE POLICY %I_org_select ON %I
    FOR SELECT USING (
      is_organization_member(organization_id)
    )
  ', p_table_name, p_table_name);
  
  -- Create INSERT policy
  EXECUTE format('
    CREATE POLICY %I_org_insert ON %I
    FOR INSERT WITH CHECK (
      is_organization_member(organization_id) AND
      is_organization_admin(organization_id)
    )
  ', p_table_name, p_table_name);
  
  -- Create UPDATE policy
  EXECUTE format('
    CREATE POLICY %I_org_update ON %I
    FOR UPDATE USING (
      is_organization_member(organization_id) AND
      is_organization_admin(organization_id)
    )
  ', p_table_name, p_table_name);
  
  -- Create DELETE policy
  EXECUTE format('
    CREATE POLICY %I_org_delete ON %I
    FOR DELETE USING (
      is_organization_owner(organization_id)
    )
  ', p_table_name, p_table_name);
  
  RAISE NOTICE 'Created RLS policies for table: %', p_table_name;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create RLS policies for table %: %', p_table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Applica RLS alle tabelle principali
SELECT create_organization_rls_policies_safe('stagioni_sportive');
SELECT create_organization_rls_policies_safe('tesserati');
SELECT create_organization_rls_policies_safe('squadre');
SELECT create_organization_rls_policies_safe('tesserati_squadre_stagioni');
SELECT create_organization_rls_policies_safe('tesserati_dati_stagionali');
SELECT create_organization_rls_policies_safe('presenze');
SELECT create_organization_rls_policies_safe('partite');
SELECT create_organization_rls_policies_safe('convocazioni');
SELECT create_organization_rls_policies_safe('magazzino');
SELECT create_organization_rls_policies_safe('movimenti_magazzino');
SELECT create_organization_rls_policies_safe('assegnazioni_materiale');
SELECT create_organization_rls_policies_safe('tornei');
SELECT create_organization_rls_policies_safe('iscrizioni_torneo');
SELECT create_organization_rls_policies_safe('eventi');
SELECT create_organization_rls_policies_safe('prenotazioni_eventi');
SELECT create_organization_rls_policies_safe('eventi_economici');
SELECT create_organization_rls_policies_safe('movimenti_economici');
SELECT create_organization_rls_policies_safe('campi');
SELECT create_organization_rls_policies_safe('calendario_campi');
SELECT create_organization_rls_policies_safe('avversari');
SELECT create_organization_rls_policies_safe('categorie_avversari');
SELECT create_organization_rls_policies_safe('parametri_sistema');

-- ==============================================================
-- STEP 8: Special RLS Policies for Users table
-- ==============================================================

-- RLS per la tabella users (più permissiva)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_org_select ON users;
DROP POLICY IF EXISTS users_org_update ON users;
DROP POLICY IF EXISTS users_org_insert ON users;

-- Users possono vedere se stessi + members della stessa org
CREATE POLICY users_org_select ON users
FOR SELECT USING (
  id = auth.uid() OR
  (organization_id IS NOT NULL AND is_organization_member(organization_id))
);

-- Users possono aggiornare se stessi + admin possono aggiornare membri
CREATE POLICY users_org_update ON users
FOR UPDATE USING (
  id = auth.uid() OR
  (organization_id IS NOT NULL AND is_organization_admin(organization_id))
);

-- Solo per creazione automatica profili
CREATE POLICY users_org_insert ON users
FOR INSERT WITH CHECK (
  id = auth.uid()
);

-- ==============================================================
-- STEP 9: Cleanup Functions
-- ==============================================================

-- Rimuovi le helper functions temporanee
DROP FUNCTION IF EXISTS migrate_table_to_default_org_safe(text);
DROP FUNCTION IF EXISTS make_organization_id_required_safe(text);
DROP FUNCTION IF EXISTS create_organization_rls_policies_safe(text);

-- ==============================================================
-- STEP 10: Statistiche finali
-- ==============================================================

-- Inserisci statistiche della migrazione
DO $$
BEGIN
  -- Controlla se il record esiste già
  IF EXISTS (
    SELECT 1 FROM parametri_sistema 
    WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID 
    AND chiave = 'migration_030_completed'
  ) THEN
    -- Aggiorna se esiste
    UPDATE parametri_sistema 
    SET valore = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at = NOW()
    WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID 
    AND chiave = 'migration_030_completed';
    
    RAISE NOTICE 'Updated migration completion timestamp';
  ELSE
    -- Inserisci se non esiste
    INSERT INTO parametri_sistema (
      organization_id,
      chiave,
      valore,
      descrizione,
      created_at
    ) VALUES (
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
      'migration_030_completed',
      to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
      'Multi-organization setup completed',
      NOW()
    );
    
    RAISE NOTICE 'Inserted migration completion record';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not insert/update parametri_sistema: %', SQLERRM;
END $$;

-- Vista per verificare lo stato della migrazione
CREATE OR REPLACE VIEW migration_status AS
SELECT 
  'organizations' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE slug = 'virpol-campogalliano') as default_org_exists
FROM organizations
UNION ALL
SELECT 
  'organization_members' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID) as default_org_members
FROM organization_members
UNION ALL
SELECT 
  'tesserati' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID) as migrated_records
FROM tesserati
UNION ALL
SELECT 
  'squadre' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID) as migrated_records
FROM squadre;

-- Mostra risultati finali
DO $$
BEGIN
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Multi-organization migration completed successfully!';
  RAISE NOTICE 'Default organization: Virpol Campogalliano';
  RAISE NOTICE 'Organization ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  RAISE NOTICE 'Check migration_status view for details';
  RAISE NOTICE '====================================================';
END $$;

-- Mostra risultati
SELECT * FROM migration_status;