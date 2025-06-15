-- Migration 029: Apply RLS Policies for Multi-Tenant Support
-- This migration applies Row Level Security policies to all tables for complete data isolation

-- Template function per creare RLS policies consistenti
CREATE OR REPLACE FUNCTION create_organization_rls_policies(table_name text)
RETURNS void AS $$
BEGIN
  -- Drop existing policies if they exist
  EXECUTE format('DROP POLICY IF EXISTS %I_org_isolation ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_select ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_insert ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_update ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_delete ON %I', table_name, table_name);
  
  -- Enable RLS on the table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- CREATE SELECT POLICY: solo membri dell'organization possono vedere i dati
  EXECUTE format('
    CREATE POLICY %I_org_select ON %I
    FOR SELECT USING (
      auth.is_organization_member(organization_id)
    )
  ', table_name, table_name);
  
  -- CREATE INSERT POLICY: solo admin/owner possono inserire dati
  EXECUTE format('
    CREATE POLICY %I_org_insert ON %I
    FOR INSERT WITH CHECK (
      auth.is_organization_member(organization_id) AND
      auth.is_organization_admin(organization_id)
    )
  ', table_name, table_name);
  
  -- CREATE UPDATE POLICY: basato sul ruolo nell''organization
  EXECUTE format('
    CREATE POLICY %I_org_update ON %I
    FOR UPDATE USING (
      auth.is_organization_member(organization_id) AND
      auth.is_organization_admin(organization_id)
    )
  ', table_name, table_name);
  
  -- CREATE DELETE POLICY: solo owner può eliminare
  EXECUTE format('
    CREATE POLICY %I_org_delete ON %I
    FOR DELETE USING (
      auth.is_organization_owner(organization_id)
    )
  ', table_name, table_name);
  
  RAISE NOTICE 'Created RLS policies for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Applica RLS policies a tutte le tabelle principali
SELECT create_organization_rls_policies('stagioni_sportive');
SELECT create_organization_rls_policies('tesserati');
SELECT create_organization_rls_policies('squadre');
SELECT create_organization_rls_policies('tesserati_squadre_stagioni');
SELECT create_organization_rls_policies('tesserati_dati_stagionali');
SELECT create_organization_rls_policies('presenze');
SELECT create_organization_rls_policies('partite');
SELECT create_organization_rls_policies('convocazioni');
SELECT create_organization_rls_policies('magazzino');
SELECT create_organization_rls_policies('movimenti_magazzino');
SELECT create_organization_rls_policies('assegnazioni_materiale');
SELECT create_organization_rls_policies('tornei');
SELECT create_organization_rls_policies('iscrizioni_torneo');
SELECT create_organization_rls_policies('eventi');
SELECT create_organization_rls_policies('prenotazioni_eventi');
SELECT create_organization_rls_policies('eventi_economici');
SELECT create_organization_rls_policies('movimenti_economici');
SELECT create_organization_rls_policies('campi');
SELECT create_organization_rls_policies('calendario_campi');
SELECT create_organization_rls_policies('avversari');
SELECT create_organization_rls_policies('categorie_avversari');
SELECT create_organization_rls_policies('parametri_sistema');

-- Policies speciali per la tabella users (più permissive per self-management)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_org_select ON users;
DROP POLICY IF EXISTS users_org_update ON users;
DROP POLICY IF EXISTS users_org_insert ON users;

-- Users possono vedere se stessi + members della stessa org
CREATE POLICY users_org_select ON users
FOR SELECT USING (
  id = auth.uid() OR
  (organization_id IS NOT NULL AND auth.is_organization_member(organization_id))
);

-- Users possono aggiornare se stessi + admin possono aggiornare membri
CREATE POLICY users_org_update ON users
FOR UPDATE USING (
  id = auth.uid() OR
  (organization_id IS NOT NULL AND auth.is_organization_admin(organization_id))
);

-- Solo per creazione automatica profili
CREATE POLICY users_org_insert ON users
FOR INSERT WITH CHECK (
  id = auth.uid()
);

-- Policies speciali per alcune tabelle con logiche diverse

-- Convocazioni: allenatori possono gestire le proprie squadre
DROP POLICY IF EXISTS convocazioni_org_update ON convocazioni;
CREATE POLICY convocazioni_org_update ON convocazioni
FOR UPDATE USING (
  auth.is_organization_member(organization_id) AND (
    auth.is_organization_admin(organization_id) OR
    EXISTS (
      SELECT 1 FROM squadre s
      WHERE s.id = convocazioni.squadra_id
      AND s.organization_id = convocazioni.organization_id
      AND (s.allenatore_id = auth.uid() OR s.vice_allenatore_id = auth.uid())
    )
  )
);

-- Presenze: allenatori possono registrare presenze per le loro squadre
DROP POLICY IF EXISTS presenze_org_insert ON presenze;
DROP POLICY IF EXISTS presenze_org_update ON presenze;

CREATE POLICY presenze_org_insert ON presenze
FOR INSERT WITH CHECK (
  auth.is_organization_member(organization_id) AND (
    auth.is_organization_admin(organization_id) OR
    EXISTS (
      SELECT 1 FROM squadre s
      WHERE s.id = presenze.squadra_id
      AND s.organization_id = presenze.organization_id
      AND (s.allenatore_id = auth.uid() OR s.vice_allenatore_id = auth.uid())
    )
  )
);

CREATE POLICY presenze_org_update ON presenze
FOR UPDATE USING (
  auth.is_organization_member(organization_id) AND (
    auth.is_organization_admin(organization_id) OR
    EXISTS (
      SELECT 1 FROM squadre s
      WHERE s.id = presenze.squadra_id
      AND s.organization_id = presenze.organization_id
      AND (s.allenatore_id = auth.uid() OR s.vice_allenatore_id = auth.uid())
    )
  )
);

-- Magazzino: solo admin possono gestire
DROP POLICY IF EXISTS magazzino_org_insert ON magazzino;
DROP POLICY IF EXISTS magazzino_org_update ON magazzino;

CREATE POLICY magazzino_org_insert ON magazzino
FOR INSERT WITH CHECK (
  auth.is_organization_member(organization_id) AND
  auth.is_organization_admin(organization_id)
);

CREATE POLICY magazzino_org_update ON magazzino
FOR UPDATE USING (
  auth.is_organization_member(organization_id) AND
  auth.is_organization_admin(organization_id)
);

-- Cleanup function
DROP FUNCTION create_organization_rls_policies(text);

-- Applica trigger per auto-assegnazione organization_id a tabelle critiche
CREATE OR REPLACE FUNCTION create_org_trigger(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    DROP TRIGGER IF EXISTS %I_auto_org_id ON %I;
    CREATE TRIGGER %I_auto_org_id
      BEFORE INSERT ON %I
      FOR EACH ROW
      EXECUTE FUNCTION auto_assign_organization_id();
  ', table_name, table_name, table_name, table_name);
  
  RAISE NOTICE 'Created organization_id trigger for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- Applica trigger alle tabelle che richiedono auto-assegnazione
SELECT create_org_trigger('tesserati');
SELECT create_org_trigger('squadre');
SELECT create_org_trigger('presenze');
SELECT create_org_trigger('partite');
SELECT create_org_trigger('magazzino');
SELECT create_org_trigger('tornei');
SELECT create_org_trigger('eventi');

-- Cleanup
DROP FUNCTION create_org_trigger(text);

-- Test RLS policies (opzionale, per debug)
CREATE OR REPLACE FUNCTION test_rls_isolation()
RETURNS TABLE(table_name text, policy_count integer) AS $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'tesserati', 'squadre', 'presenze', 'partite', 
    'magazzino', 'tornei', 'eventi', 'users'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    RETURN QUERY
    SELECT 
      tbl,
      COUNT(*)::integer
    FROM pg_policies 
    WHERE tablename = tbl;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Esegui test per verificare che le policies siano state create
-- SELECT * FROM test_rls_isolation();

-- Cleanup test function
DROP FUNCTION test_rls_isolation();

-- Crea vista per monitoring delle organizations
CREATE OR REPLACE VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  o.slug,
  o.subscription_plan,
  COUNT(DISTINCT om.user_id) as member_count,
  COUNT(DISTINCT t.id) as tesserati_count,
  COUNT(DISTINCT s.id) as squadre_count,
  o.max_tesserati,
  o.max_squadre,
  o.created_at
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id
LEFT JOIN tesserati t ON o.id = t.organization_id AND t.stato = true
LEFT JOIN squadre s ON o.id = s.organization_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.slug, o.subscription_plan, o.max_tesserati, o.max_squadre, o.created_at;

-- Permissions sulla vista
GRANT SELECT ON organization_stats TO authenticated;