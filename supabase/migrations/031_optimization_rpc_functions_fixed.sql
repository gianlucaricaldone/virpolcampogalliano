-- =====================================================
-- OTTIMIZZAZIONI PERFORMANCE - RPC FUNCTIONS (FIXED)
-- Migrate all N+1 queries e query multiple to optimized SQL
-- =====================================================

-- 2. Recent Activities (4 queries -> 1 RPC with UNION) - FIXED VERSION
CREATE OR REPLACE FUNCTION get_recent_activities(activity_limit int DEFAULT 10)
RETURNS TABLE(
    activity_type text,
    title text,
    description text,
    activity_timestamp timestamptz,
    icon text,
    color text,
    href text
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        -- Presenze
        SELECT 
            'presenza'::text as activity_type,
            'Presenza registrata'::text as title,
            CONCAT(t.nome, ' ', t.cognome, ' - ', p.tipo) as description,
            p.created_at as activity_timestamp,
            CASE WHEN p.presente THEN 'check' ELSE 'x' END as icon,
            CASE WHEN p.presente THEN 'text-green-600' ELSE 'text-red-600' END as color,
            '/dashboard/presenze'::text as href
        FROM presenze p
        JOIN tesserati t ON p.tesserato_id = t.id
        ORDER BY p.created_at DESC
        LIMIT (activity_limit / 2)

        UNION ALL

        -- Tesserati
        SELECT 
            'tesserato'::text as activity_type,
            'Nuovo tesserato'::text as title,
            CONCAT(nome, ' ', cognome, ' registrato') as description,
            created_at as activity_timestamp,
            'user-plus'::text as icon,
            'text-blue-600'::text as color,
            '/dashboard/tesserati'::text as href
        FROM tesserati
        WHERE stato = true
        ORDER BY created_at DESC
        LIMIT 3

        UNION ALL

        -- Partite
        SELECT 
            'partita'::text as activity_type,
            'Partita programmata'::text as title,
            CONCAT(COALESCE(s.nome, 'Squadra'), ' vs ', p.avversario) as description,
            p.created_at as activity_timestamp,
            'trophy'::text as icon,
            'text-purple-600'::text as color,
            '/dashboard/partite'::text as href
        FROM partite p
        LEFT JOIN squadre s ON p.squadra_id = s.id
        ORDER BY p.created_at DESC
        LIMIT 3

        UNION ALL

        -- Reports (solo se la tabella esiste)
        SELECT 
            'report'::text as activity_type,
            'Nuovo report'::text as title,
            CONCAT('Report di ', COALESCE(u.nome, 'Allenatore'), ' ', COALESCE(u.cognome, '')) as description,
            r.created_at as activity_timestamp,
            'file-text'::text as icon,
            'text-orange-600'::text as color,
            '/dashboard/presenze'::text as href
        FROM report_allenatori r
        LEFT JOIN users u ON r.allenatore_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 2
    ) combined_activities
    ORDER BY activity_timestamp DESC
    LIMIT activity_limit;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback se qualche tabella non esiste
        RETURN QUERY
        SELECT 
            'system'::text as activity_type,
            'Sistema'::text as title,
            'Nessuna attività recente disponibile'::text as description,
            NOW() as activity_timestamp,
            'clock'::text as icon,
            'text-gray-500'::text as color,
            '/dashboard'::text as href
        LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 3. Bulk Presenze Operations (N queries -> 1 RPC) - FIXED VERSION
CREATE OR REPLACE FUNCTION bulk_update_presenze(
    tesserato_ids uuid[],
    presenza_data date,
    presenza_tipo text,
    is_presente boolean,
    squadra_id_param uuid DEFAULT NULL,
    stagione_id_param uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Use UPSERT for efficient bulk operations
    INSERT INTO presenze (
        tesserato_id, 
        data, 
        tipo, 
        presente, 
        squadra_id, 
        stagione_id,
        created_at,
        updated_at
    )
    SELECT 
        unnest(tesserato_ids),
        presenza_data,
        presenza_tipo,
        is_presente,
        squadra_id_param,
        stagione_id_param,
        NOW(),
        NOW()
    ON CONFLICT (tesserato_id, data, tipo)
    DO UPDATE SET
        presente = EXCLUDED.presente,
        squadra_id = COALESCE(EXCLUDED.squadra_id, presenze.squadra_id),
        stagione_id = COALESCE(EXCLUDED.stagione_id, presenze.stagione_id),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 4. Statistiche Presenze Ottimizzate - FIXED VERSION
CREATE OR REPLACE FUNCTION get_statistiche_presenze(
    squadra_id_param uuid DEFAULT NULL,
    periodo_param text DEFAULT 'settimanale'
)
RETURNS TABLE(
    tesserato_id uuid,
    tesserato_nome text,
    squadra_id uuid,
    squadra_nome text,
    presenze bigint,
    totale bigint,
    percentuale numeric
) AS $$
DECLARE
    filter_date date;
BEGIN
    -- Calculate filter date based on periodo
    filter_date := CASE 
        WHEN periodo_param = 'settimanale' THEN CURRENT_DATE - interval '7 days'
        WHEN periodo_param = 'mensile' THEN CURRENT_DATE - interval '30 days'
        ELSE CURRENT_DATE - interval '7 days'
    END;

    RETURN QUERY
    SELECT 
        p.tesserato_id,
        CONCAT(t.nome, ' ', t.cognome) as tesserato_nome,
        p.squadra_id,
        COALESCE(s.nome, 'Squadra sconosciuta') as squadra_nome,
        COUNT(CASE WHEN p.presente = true THEN 1 END) as presenze,
        COUNT(*) as totale,
        ROUND(
            (COUNT(CASE WHEN p.presente = true THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
            0
        ) as percentuale
    FROM presenze p
    JOIN tesserati t ON p.tesserato_id = t.id
    LEFT JOIN squadre s ON p.squadra_id = s.id
    WHERE p.data >= filter_date
    AND (squadra_id_param IS NULL OR p.squadra_id = squadra_id_param)
    GROUP BY p.tesserato_id, t.nome, t.cognome, p.squadra_id, s.nome
    HAVING COUNT(*) > 0
    ORDER BY percentuale DESC, presenze DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. Performance Indexes for optimization - IMPROVED VERSION
-- Droppa gli indici se esistono già per evitare errori
DROP INDEX IF EXISTS idx_presenze_data_tipo;
DROP INDEX IF EXISTS idx_presenze_tesserato_data;
DROP INDEX IF EXISTS idx_tesserati_cognome_active;
DROP INDEX IF EXISTS idx_partite_data_stagione;
DROP INDEX IF EXISTS idx_squadre_stagione;

-- Crea indici ottimizzati
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_presenze_data_tipo 
ON presenze (data, tipo) 
WHERE presente = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_presenze_tesserato_data 
ON presenze (tesserato_id, data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tesserati_cognome_active 
ON tesserati (cognome) 
WHERE stato = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partite_data_stagione 
ON partite (data, stagione_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_squadre_stagione 
ON squadre (stagione_id);

-- Indice per recent activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_presenze_created_at 
ON presenze (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tesserati_created_at 
ON tesserati (created_at DESC) 
WHERE stato = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partite_created_at 
ON partite (created_at DESC);

-- 6. Materialized View for heavy dashboard stats (IMPROVED VERSION)
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats;

CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT 
    -- Squadre attive per stagione corrente
    (SELECT COUNT(*) FROM squadre WHERE stagione_id IS NOT NULL) as squadre_totali,
    
    -- Tesserati attivi
    (SELECT COUNT(*) FROM tesserati WHERE stato = true) as tesserati_attivi,
    
    -- Partite questa settimana
    (SELECT COUNT(*) FROM partite WHERE 
        data >= CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int)
        AND data <= CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::int)
    ) as partite_settimana,
    
    -- Presenze oggi
    (SELECT COUNT(*) FROM presenze WHERE 
        data = CURRENT_DATE AND presente = true
    ) as presenze_oggi,
    
    -- Totale magazzino
    (SELECT COALESCE(SUM(quantita), 0)::int FROM magazzino) as magazzino_totale,
    
    -- Certificati in scadenza (30 giorni)
    (SELECT COUNT(*) FROM tesserati WHERE 
        scadenza_certificato IS NOT NULL 
        AND scadenza_certificato BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
    ) as certificati_scadenza,
    
    NOW() as last_updated;

-- Create unique index for materialized view
CREATE UNIQUE INDEX ON mv_dashboard_stats (last_updated);

-- 7. Refresh function for materialized view - IMPROVED VERSION
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback to non-concurrent refresh if needed
        REFRESH MATERIALIZED VIEW mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- 8. Composite unique constraint to support upsert in bulk_update_presenze - IMPROVED VERSION
DO $$ 
BEGIN
    -- Add constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'presenze_tesserato_data_tipo_unique'
    ) THEN
        ALTER TABLE presenze 
        ADD CONSTRAINT presenze_tesserato_data_tipo_unique 
        UNIQUE (tesserato_id, data, tipo);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        -- Constraint already exists, ignore
        NULL;
END $$;

-- 9. Grant permissions for RPC functions - COMPREHENSIVE VERSION
GRANT EXECUTE ON FUNCTION get_recent_activities(int) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_presenze(uuid[], date, text, boolean, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_statistiche_presenze(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;

-- Grant permissions for materialized view
GRANT SELECT ON mv_dashboard_stats TO authenticated;

-- 10. Dashboard Stats Function (Alternative to materialized view) - NEW
CREATE OR REPLACE FUNCTION get_dashboard_stats_dynamic(stagione_id_param uuid DEFAULT NULL)
RETURNS json AS $$
DECLARE
    result json;
    today date := CURRENT_DATE;
    week_start date := today - (EXTRACT(DOW FROM today)::int);
    week_end date := week_start + interval '6 days';
    in_30_days date := today + interval '30 days';
BEGIN
    -- Single query with all aggregations
    SELECT json_build_object(
        'squadre', COALESCE((
            SELECT COUNT(*) 
            FROM squadre 
            WHERE (stagione_id_param IS NULL OR stagione_id = stagione_id_param)
        ), 0),
        'tesserati', COALESCE((
            SELECT COUNT(*) 
            FROM tesserati 
            WHERE stato = true
        ), 0),
        'partite', COALESCE((
            SELECT COUNT(*) 
            FROM partite 
            WHERE data BETWEEN week_start AND week_end
            AND (stagione_id_param IS NULL OR stagione_id = stagione_id_param)
        ), 0),
        'presenze', COALESCE((
            SELECT COUNT(*) 
            FROM presenze 
            WHERE data = today AND presente = true
        ), 0),
        'magazzino', COALESCE((
            SELECT COALESCE(SUM(quantita), 0)::int
            FROM magazzino
        ), 0),
        'scadenze', COALESCE((
            SELECT COUNT(*) 
            FROM tesserati 
            WHERE scadenza_certificato IS NOT NULL
            AND scadenza_certificato BETWEEN today AND in_30_days
        ), 0)
    ) INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return default values on error
        RETURN json_build_object(
            'squadre', 0,
            'tesserati', 0,
            'partite', 0,
            'presenze', 0,
            'magazzino', 0,
            'scadenze', 0
        );
END;
$$ LANGUAGE plpgsql;

-- Grant permission for new dashboard function
GRANT EXECUTE ON FUNCTION get_dashboard_stats_dynamic(uuid) TO authenticated;

-- 11. Comments for documentation
COMMENT ON FUNCTION get_recent_activities IS 'Unified recent activities query - replaces 4 separate queries with error handling';
COMMENT ON FUNCTION bulk_update_presenze IS 'Bulk presence operations - eliminates N+1 query pattern';
COMMENT ON FUNCTION get_statistiche_presenze IS 'Optimized attendance statistics with aggregations';
COMMENT ON FUNCTION get_dashboard_stats_dynamic IS 'Dynamic dashboard statistics - single query for all stats with fallback';
COMMENT ON FUNCTION refresh_dashboard_stats IS 'Refresh materialized view with concurrent support and fallback';

-- 12. Setup automatic refresh (optional - requires pg_cron extension)
-- Uncomment the following line if pg_cron is available:
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats();');