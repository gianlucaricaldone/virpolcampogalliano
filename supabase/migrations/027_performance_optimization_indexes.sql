-- Performance Optimization Migration
-- Add missing indexes on foreign keys and commonly queried columns

-- =====================================================
-- FOREIGN KEY INDEXES
-- =====================================================

-- tesserati table indexes
-- NOTA: squadra_id non esiste più in tesserati, la relazione è gestita da tesserati_squadre_stagioni
CREATE INDEX IF NOT EXISTS idx_tesserati_cognome_nome ON public.tesserati(cognome, nome);
CREATE INDEX IF NOT EXISTS idx_tesserati_email ON public.tesserati(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tesserati_telefono ON public.tesserati(telefono) WHERE telefono IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tesserati_codice_fiscale ON public.tesserati(codice_fiscale) WHERE codice_fiscale IS NOT NULL;

-- presenze table indexes
CREATE INDEX IF NOT EXISTS idx_presenze_tesserato_id ON public.presenze(tesserato_id);
CREATE INDEX IF NOT EXISTS idx_presenze_data ON public.presenze(data);
CREATE INDEX IF NOT EXISTS idx_presenze_tesserato_data ON public.presenze(tesserato_id, data);
CREATE INDEX IF NOT EXISTS idx_presenze_squadra_id ON public.presenze(squadra_id);

-- convocazioni table indexes
CREATE INDEX IF NOT EXISTS idx_convocazioni_partita_id ON public.convocazioni(partita_id);
CREATE INDEX IF NOT EXISTS idx_convocazioni_tesserato_id ON public.convocazioni(tesserato_id);
CREATE INDEX IF NOT EXISTS idx_convocazioni_partita_tesserato ON public.convocazioni(partita_id, tesserato_id);

-- calendario_campi table indexes
CREATE INDEX IF NOT EXISTS idx_calendario_campi_campo_id ON public.calendario_campi(campo_id);
CREATE INDEX IF NOT EXISTS idx_calendario_campi_squadra_id ON public.calendario_campi(squadra_id);
CREATE INDEX IF NOT EXISTS idx_calendario_campi_data ON public.calendario_campi(data);
CREATE INDEX IF NOT EXISTS idx_calendario_campi_campo_data ON public.calendario_campi(campo_id, data);

-- partite table indexes
CREATE INDEX IF NOT EXISTS idx_partite_squadra_id ON public.partite(squadra_id);
CREATE INDEX IF NOT EXISTS idx_partite_data ON public.partite(data);
CREATE INDEX IF NOT EXISTS idx_partite_squadra_data ON public.partite(squadra_id, data);
CREATE INDEX IF NOT EXISTS idx_partite_categoria_avversario_id ON public.partite(categoria_avversario_id);
CREATE INDEX IF NOT EXISTS idx_partite_stagione_id ON public.partite(stagione_id);

-- iscrizioni_torneo table indexes
CREATE INDEX IF NOT EXISTS idx_iscrizioni_torneo_torneo_id ON public.iscrizioni_torneo(torneo_id);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_torneo_stato ON public.iscrizioni_torneo(stato_iscrizione);

-- assegnazioni_materiale table indexes
CREATE INDEX IF NOT EXISTS idx_assegnazioni_materiale_materiale_id ON public.assegnazioni_materiale(materiale_id);
CREATE INDEX IF NOT EXISTS idx_assegnazioni_materiale_squadra_id ON public.assegnazioni_materiale(squadra_id);
CREATE INDEX IF NOT EXISTS idx_assegnazioni_materiale_tesserato_id ON public.assegnazioni_materiale(tesserato_id);
CREATE INDEX IF NOT EXISTS idx_assegnazioni_materiale_attive ON public.assegnazioni_materiale(materiale_id, squadra_id) WHERE stato = 'attiva';

-- movimenti_economici table indexes
CREATE INDEX IF NOT EXISTS idx_movimenti_economici_evento_id ON public.movimenti_economici(evento_id);
CREATE INDEX IF NOT EXISTS idx_movimenti_economici_data ON public.movimenti_economici(data_movimento);
CREATE INDEX IF NOT EXISTS idx_movimenti_economici_tipo ON public.movimenti_economici(tipo);
CREATE INDEX IF NOT EXISTS idx_movimenti_economici_evento_tipo_data ON public.movimenti_economici(evento_id, tipo, data_movimento);

-- categorie_avversari table indexes
CREATE INDEX IF NOT EXISTS idx_categorie_avversari_avversario_id ON public.categorie_avversari(avversario_id);
CREATE INDEX IF NOT EXISTS idx_categorie_avversari_stagione_id ON public.categorie_avversari(stagione_id);

-- eventi_economici table indexes
CREATE INDEX IF NOT EXISTS idx_eventi_economici_data ON public.eventi_economici(data_evento);
CREATE INDEX IF NOT EXISTS idx_eventi_economici_tipo ON public.eventi_economici(tipo);
CREATE INDEX IF NOT EXISTS idx_eventi_economici_tesserato_id ON public.eventi_economici(tesserato_id) WHERE tesserato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventi_economici_squadra_id ON public.eventi_economici(squadra_id) WHERE squadra_id IS NOT NULL;

-- tornei table indexes
CREATE INDEX IF NOT EXISTS idx_tornei_stato ON public.tornei(stato);
CREATE INDEX IF NOT EXISTS idx_tornei_data_inizio ON public.tornei(data_inizio);
CREATE INDEX IF NOT EXISTS idx_tornei_stagione_id ON public.tornei(stagione_id);

-- magazzino table indexes
CREATE INDEX IF NOT EXISTS idx_magazzino_tipo_materiale ON public.magazzino(tipo_materiale);
CREATE INDEX IF NOT EXISTS idx_magazzino_stagione_id ON public.magazzino(stagione_id);

-- movimenti_magazzino table indexes
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_materiale_id ON public.movimenti_magazzino(materiale_id);
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_data ON public.movimenti_magazzino(data_movimento);
CREATE INDEX IF NOT EXISTS idx_movimenti_magazzino_tipo ON public.movimenti_magazzino(tipo_movimento);

-- =====================================================
-- ARRAY AND JSONB INDEXES
-- =====================================================

-- Array indexes using GIN
CREATE INDEX IF NOT EXISTS idx_users_squadra_id_gin ON public.users USING GIN(squadra_id);
CREATE INDEX IF NOT EXISTS idx_users_ruoli_gin ON public.users USING GIN(ruoli);

-- JSONB indexes using GIN
CREATE INDEX IF NOT EXISTS idx_tornei_regolamento_gin ON public.tornei USING GIN(regolamento);
CREATE INDEX IF NOT EXISTS idx_iscrizioni_torneo_documenti_gin ON public.iscrizioni_torneo USING GIN(documenti);
CREATE INDEX IF NOT EXISTS idx_eventi_preferenze_gin ON public.eventi USING GIN(preferenze);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================

-- Lookup indexes for tesserati relationships
CREATE INDEX IF NOT EXISTS idx_tesserati_squadre_stagioni_lookup 
ON public.tesserati_squadre_stagioni(tesserato_id, stagione_id, squadra_id);

CREATE INDEX IF NOT EXISTS idx_tesserati_squadre_stagioni_stagione_squadra 
ON public.tesserati_squadre_stagioni(stagione_id, squadra_id);

-- Lookup indexes for tesserati seasonal data
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_lookup 
ON public.tesserati_dati_stagionali(tesserato_id, stagione_id);

-- Certificate expiry queries
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_scadenza 
ON public.tesserati_dati_stagionali(scadenza_certificato) 
WHERE scadenza_certificato IS NOT NULL;

-- Active season indexes
CREATE INDEX IF NOT EXISTS idx_squadre_stagione_attive 
ON public.squadre(stagione_id) 
WHERE stagione_id IS NOT NULL;

-- =====================================================
-- OPTIMIZE EXISTING CONSTRAINTS
-- =====================================================

-- Replace inefficient EXCLUDE constraint with partial unique index for stagioni_sportive
-- First check if the constraint exists before dropping
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_single_active' 
        AND conrelid = 'public.stagioni_sportive'::regclass
    ) THEN
        ALTER TABLE public.stagioni_sportive DROP CONSTRAINT check_single_active;
    END IF;
END $$;

-- Create partial unique index for single active season
CREATE UNIQUE INDEX IF NOT EXISTS idx_stagioni_sportive_single_active 
ON public.stagioni_sportive(attiva) 
WHERE attiva = true;

-- =====================================================
-- TEXT SEARCH INDEXES
-- =====================================================

-- Create text search indexes for name searches
CREATE INDEX IF NOT EXISTS idx_tesserati_search_cognome ON public.tesserati USING btree(lower(cognome));
CREATE INDEX IF NOT EXISTS idx_tesserati_search_nome ON public.tesserati USING btree(lower(nome));
CREATE INDEX IF NOT EXISTS idx_avversari_search_nome ON public.avversari USING btree(lower(nome));
CREATE INDEX IF NOT EXISTS idx_squadre_search_nome ON public.squadre USING btree(lower(nome));

-- =====================================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- =====================================================

-- Active/inactive status indexes
CREATE INDEX IF NOT EXISTS idx_tesserati_attivi ON public.tesserati(id) WHERE stato = true;
CREATE INDEX IF NOT EXISTS idx_squadre_attive ON public.squadre(id) WHERE attiva = true;
CREATE INDEX IF NOT EXISTS idx_tornei_attivi ON public.tornei(id) WHERE stato = 'attivo';

-- Payment status indexes
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_non_pagato 
ON public.tesserati_dati_stagionali(tesserato_id, stagione_id) 
WHERE stato_pagamento = 'non_pagato';

-- Medical certificate indexes
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_senza_visita 
ON public.tesserati_dati_stagionali(tesserato_id, stagione_id) 
WHERE visita_sportiva = false;

-- =====================================================
-- ANALYZE TABLES AFTER ADDING INDEXES
-- =====================================================

ANALYZE public.tesserati;
ANALYZE public.presenze;
ANALYZE public.partite;
ANALYZE public.convocazioni;
ANALYZE public.calendario_campi;
ANALYZE public.squadre;
ANALYZE public.assegnazioni_materiale;
ANALYZE public.movimenti_economici;
ANALYZE public.eventi_economici;
ANALYZE public.tornei;
ANALYZE public.iscrizioni_torneo;
ANALYZE public.magazzino;
ANALYZE public.movimenti_magazzino;
ANALYZE public.tesserati_squadre_stagioni;
ANALYZE public.tesserati_dati_stagionali;
ANALYZE public.categorie_avversari;
ANALYZE public.avversari;
ANALYZE public.users;
ANALYZE public.stagioni_sportive;

-- =====================================================
-- FIX DATA_NASCITA NOT NULL CONSTRAINT
-- =====================================================

-- Make data_nascita nullable in tesserati table
ALTER TABLE public.tesserati 
ALTER COLUMN data_nascita DROP NOT NULL;

-- Add comment to clarify that data_nascita is optional
COMMENT ON COLUMN public.tesserati.data_nascita IS 'Data di nascita del tesserato (opzionale)';