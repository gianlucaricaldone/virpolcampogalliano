-- Migration 026: Add organization_id to all existing tables
-- This migration adds organization_id column to all tables for multi-tenant support

-- Helper function per aggiungere organization_id in modo consistente
CREATE OR REPLACE FUNCTION add_organization_column(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    ALTER TABLE %I 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
    ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP;
    
    CREATE INDEX IF NOT EXISTS idx_%I_org_id ON %I(organization_id);
  ', table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Applica a tutte le tabelle principali
SELECT add_organization_column('stagioni_sportive');
SELECT add_organization_column('users'); -- per link user-org
SELECT add_organization_column('tesserati');
SELECT add_organization_column('squadre');
SELECT add_organization_column('tesserati_squadre_stagioni');
SELECT add_organization_column('tesserati_dati_stagionali');
SELECT add_organization_column('presenze');
SELECT add_organization_column('partite');
SELECT add_organization_column('convocazioni');
SELECT add_organization_column('magazzino');
SELECT add_organization_column('movimenti_magazzino');
SELECT add_organization_column('assegnazioni_materiale');
SELECT add_organization_column('tornei');
SELECT add_organization_column('iscrizioni_torneo');
SELECT add_organization_column('eventi');
SELECT add_organization_column('prenotazioni_eventi');
SELECT add_organization_column('eventi_economici');
SELECT add_organization_column('movimenti_economici');
SELECT add_organization_column('campi');
SELECT add_organization_column('calendario_campi');
SELECT add_organization_column('avversari');
SELECT add_organization_column('categorie_avversari');
SELECT add_organization_column('parametri_sistema');

-- Cleanup della helper function
DROP FUNCTION add_organization_column(text);

-- Aggiungi anche organization_id per le tabelle di junction/lookup se necessario
-- (alcune potrebbero non averne bisogno se sono relative solo al singolo tenant)

-- Aggiungi commenti per documentare il purpose
COMMENT ON COLUMN stagioni_sportive.organization_id IS 'References the organization this season belongs to';
COMMENT ON COLUMN tesserati.organization_id IS 'References the organization this player belongs to';
COMMENT ON COLUMN squadre.organization_id IS 'References the organization this team belongs to';
COMMENT ON COLUMN presenze.organization_id IS 'References the organization this attendance record belongs to';
COMMENT ON COLUMN partite.organization_id IS 'References the organization this match belongs to';
COMMENT ON COLUMN magazzino.organization_id IS 'References the organization this inventory item belongs to';
COMMENT ON COLUMN tornei.organization_id IS 'References the organization this tournament belongs to';
COMMENT ON COLUMN eventi.organization_id IS 'References the organization this event belongs to';
COMMENT ON COLUMN eventi_economici.organization_id IS 'References the organization this economic event belongs to';
COMMENT ON COLUMN campi.organization_id IS 'References the organization this field belongs to';