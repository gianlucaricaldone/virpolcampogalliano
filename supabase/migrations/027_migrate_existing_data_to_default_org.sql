-- Migration 027: Migrate existing data to default organization
-- This migration creates a default organization and assigns all existing data to it

-- Crea organization di default per dati esistenti
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
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID, -- UUID fisso per riferimento
  'Virpol Campogalliano',
  'virpol-campogalliano',
  'enterprise', -- dai tutti i permessi alla org originale
  'active',
  9999,
  999,
  100, -- 100GB storage
  '{
    "sms": true,
    "email": true,
    "export": true,
    "api_access": true,
    "custom_domain": true,
    "white_label": true
  }'::jsonb,
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Helper function per migrare dati a default organization
CREATE OR REPLACE FUNCTION migrate_table_to_default_org(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    UPDATE %I 
    SET organization_id = ''a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11''::UUID,
        migrated_at = NOW()
    WHERE organization_id IS NULL;
  ', table_name);
  
  RAISE NOTICE 'Migrated table % to default organization', table_name;
END;
$$ LANGUAGE plpgsql;

-- Migra tutte le tabelle alla default organization
SELECT migrate_table_to_default_org('stagioni_sportive');
SELECT migrate_table_to_default_org('tesserati');
SELECT migrate_table_to_default_org('squadre');
SELECT migrate_table_to_default_org('tesserati_squadre_stagioni');
SELECT migrate_table_to_default_org('tesserati_dati_stagionali');
SELECT migrate_table_to_default_org('presenze');
SELECT migrate_table_to_default_org('partite');
SELECT migrate_table_to_default_org('convocazioni');
SELECT migrate_table_to_default_org('magazzino');
SELECT migrate_table_to_default_org('movimenti_magazzino');
SELECT migrate_table_to_default_org('assegnazioni_materiale');
SELECT migrate_table_to_default_org('tornei');
SELECT migrate_table_to_default_org('iscrizioni_torneo');
SELECT migrate_table_to_default_org('eventi');
SELECT migrate_table_to_default_org('prenotazioni_eventi');
SELECT migrate_table_to_default_org('eventi_economici');
SELECT migrate_table_to_default_org('movimenti_economici');
SELECT migrate_table_to_default_org('campi');
SELECT migrate_table_to_default_org('calendario_campi');
SELECT migrate_table_to_default_org('avversari');
SELECT migrate_table_to_default_org('categorie_avversari');
SELECT migrate_table_to_default_org('parametri_sistema');

-- Verifica che il constraint di unicità esista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organization_members_org_user_unique'
  ) THEN
    ALTER TABLE organization_members 
    ADD CONSTRAINT organization_members_org_user_unique 
    UNIQUE (organization_id, user_id);
  END IF;
END $$;

-- Migra anche tutti gli utenti esistenti come membri della default organization
-- Usa INSERT solo se l'utente non è già membro
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

-- Aggiorna anche la tabella users per collegarla alla organization
UPDATE users 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    migrated_at = NOW()
WHERE organization_id IS NULL;

-- Cleanup della helper function
DROP FUNCTION migrate_table_to_default_org(text);

-- Helper function per rendere organization_id NOT NULL dopo la migrazione
CREATE OR REPLACE FUNCTION make_organization_id_required(table_name text)
RETURNS void AS $$
DECLARE
  null_count INTEGER;
BEGIN
  -- Verifica che tutti i record abbiano organization_id
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id IS NULL', table_name) INTO null_count;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Table % still has % records with NULL organization_id', table_name, null_count;
  END IF;
  
  -- Rendi organization_id NOT NULL
  EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL;', table_name);
  
  RAISE NOTICE 'Made organization_id NOT NULL for table %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Applica NOT NULL constraint a tutte le tabelle principali
-- (Escludi users che potrebbero avere alcuni record senza org)
SELECT make_organization_id_required('stagioni_sportive');
SELECT make_organization_id_required('tesserati');
SELECT make_organization_id_required('squadre');
SELECT make_organization_id_required('tesserati_squadre_stagioni');
SELECT make_organization_id_required('tesserati_dati_stagionali');
SELECT make_organization_id_required('presenze');
SELECT make_organization_id_required('partite');
SELECT make_organization_id_required('convocazioni');
SELECT make_organization_id_required('magazzino');
SELECT make_organization_id_required('movimenti_magazzino');
SELECT make_organization_id_required('assegnazioni_materiale');
SELECT make_organization_id_required('tornei');
SELECT make_organization_id_required('iscrizioni_torneo');
SELECT make_organization_id_required('eventi');
SELECT make_organization_id_required('prenotazioni_eventi');
SELECT make_organization_id_required('eventi_economici');
SELECT make_organization_id_required('movimenti_economici');
SELECT make_organization_id_required('campi');
SELECT make_organization_id_required('calendario_campi');
SELECT make_organization_id_required('avversari');
SELECT make_organization_id_required('categorie_avversari');
SELECT make_organization_id_required('parametri_sistema');

-- Cleanup
DROP FUNCTION make_organization_id_required(text);

-- Aggiungi statistiche della migrazione
INSERT INTO parametri_sistema (
  organization_id,
  chiave,
  valore,
  descrizione,
  created_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
  'migration_027_completed',
  to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  'Migration to multi-tenant completed',
  NOW()
) ON CONFLICT (organization_id, chiave) DO UPDATE SET
  valore = EXCLUDED.valore,
  updated_at = NOW();