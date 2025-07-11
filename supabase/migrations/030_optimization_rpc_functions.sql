-- =====================================================
-- OTTIMIZZAZIONI PERFORMANCE - RPC FUNCTIONS
-- Migrate all N+1 queries e query multiple to optimized SQL
-- =====================================================

-- 1. Dashboard Statistics (6 queries -> 1 RPC)
CREATE OR REPLACE FUNCTION get_dashboard_stats(stagione_id_param uuid DEFAULT NULL)
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
END;
$$ LANGUAGE plpgsql;

-- 2. Recent Activities (4 queries -> 1 RPC with UNION)
CREATE OR REPLACE FUNCTION get_recent_activities(activity_limit int DEFAULT 10)
RETURNS table(
    activity_type text,
    title text,
    description text,
    timestamp timestamptz,
    icon text,
    color text,
    href text
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Presenze
        SELECT 
            'presenza'::text as activity_type,
            'Presenza registrata'::text as title,
            CONCAT(t.nome, ' ', t.cognome, ' - ', p.tipo) as description,
            p.created_at as timestamp,
            CASE WHEN p.presente THEN 'check' ELSE 'x' END as icon,
            CASE WHEN p.presente THEN 'text-green-600' ELSE 'text-red-600' END as color,
            '/dashboard/presenze'::text as href
        FROM presenze p
        JOIN tesserati t ON p.tesserato_id = t.id
        ORDER BY p.created_at DESC
        LIMIT activity_limit / 2

        UNION ALL

        -- Tesserati
        SELECT 
            'tesserato'::text,
            'Nuovo tesserato'::text,
            CONCAT(nome, ' ', cognome, ' registrato'),
            created_at,
            'user-plus'::text,
            'text-blue-600'::text,
            '/dashboard/tesserati'::text
        FROM tesserati
        WHERE stato = true
        ORDER BY created_at DESC
        LIMIT 3

        UNION ALL

        -- Partite
        SELECT 
            'partita'::text,
            'Partita programmata'::text,
            CONCAT(s.nome, ' vs ', p.avversario),
            p.created_at,
            'trophy'::text,
            'text-purple-600'::text,
            '/dashboard/partite'::text
        FROM partite p
        LEFT JOIN squadre s ON p.squadra_id = s.id
        ORDER BY p.created_at DESC
        LIMIT 3

        UNION ALL

        -- Reports
        SELECT 
            'report'::text,
            'Nuovo report'::text,
            CONCAT('Report di ', u.nome, ' ', u.cognome),
            r.created_at,
            'file-text'::text,
            'text-orange-600'::text,
            '/dashboard/presenze'::text
        FROM report_allenatori r
        JOIN users u ON r.allenatore_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 2
    )
    ORDER BY timestamp DESC
    LIMIT activity_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. Bulk Presenze Operations (N queries -> 1 RPC)
CREATE OR REPLACE FUNCTION bulk_update_presenze(
    tesserato_ids uuid[],
    presenza_data date,
    presenza_tipo text,
    is_presente boolean,
    squadra_id_param uuid DEFAULT NULL,
    stagione_id_param uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    tesserato_id uuid;
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

-- 4. Statistiche Presenze Ottimizzate
CREATE OR REPLACE FUNCTION get_statistiche_presenze(
    squadra_id_param uuid DEFAULT NULL,
    periodo_param text DEFAULT 'settimanale'
)
RETURNS table(
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
        s.nome as squadra_nome,
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

-- 5. Performance Indexes for optimization
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

-- 6. Materialized View for heavy dashboard stats (optional, for high traffic)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_stats AS
SELECT 
    COUNT(DISTINCT s.id) FILTER (WHERE s.stagione_id IS NOT NULL) as squadre_totali,
    COUNT(DISTINCT t.id) FILTER (WHERE t.stato = true) as tesserati_attivi,
    COUNT(DISTINCT p.id) FILTER (WHERE p.data >= CURRENT_DATE - interval '7 days') as partite_settimana,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.data = CURRENT_DATE AND pr.presente = true) as presenze_oggi,
    COALESCE(SUM(m.quantita), 0)::int as magazzino_totale,
    COUNT(DISTINCT t2.id) FILTER (
        WHERE t2.scadenza_certificato IS NOT NULL 
        AND t2.scadenza_certificato BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days'
    ) as certificati_scadenza,
    NOW() as last_updated
FROM tesserati t
CROSS JOIN squadre s
CROSS JOIN partite p  
CROSS JOIN presenze pr
CROSS JOIN magazzino m
CROSS JOIN tesserati t2;

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Auto-refresh every 5 minutes (uncomment if pg_cron extension available)
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats();');

-- 7. Composite unique constraint to support upsert in bulk_update_presenze
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
END $$;

-- 8. Grant permissions for RPC functions
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_activities(int) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_presenze(uuid[], date, text, boolean, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_statistiche_presenze(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_dashboard_stats IS 'Optimized dashboard statistics - replaces 6 separate queries with 1 RPC';
COMMENT ON FUNCTION get_recent_activities IS 'Unified recent activities query - replaces 4 separate queries';
COMMENT ON FUNCTION bulk_update_presenze IS 'Bulk presence operations - eliminates N+1 query pattern';
COMMENT ON FUNCTION get_statistiche_presenze IS 'Optimized attendance statistics with aggregations';