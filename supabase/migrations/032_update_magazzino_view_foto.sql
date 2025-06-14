-- Update v_magazzino_dettaglio view to include foto_url field

-- Drop and recreate the view to include foto_url
DROP VIEW IF EXISTS public.v_magazzino_dettaglio CASCADE;
CREATE VIEW public.v_magazzino_dettaglio AS
SELECT 
  m.*,
  COALESCE(
    (SELECT SUM(am.quantita - COALESCE(am.quantita_restituita, 0))
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = m.id 
     AND am.stato IN ('attiva', 'parziale')
     AND am.stagione_id = m.stagione_id),
    0
  ) as quantita_assegnata,
  -- La quantità disponibile è quella NON assegnata (non quella totale)
  m.quantita - COALESCE(
    (SELECT SUM(am.quantita - COALESCE(am.quantita_restituita, 0))
     FROM public.assegnazioni_materiale am 
     WHERE am.materiale_id = m.id 
     AND am.stato IN ('attiva', 'parziale')
     AND am.stagione_id = m.stagione_id),
    0
  ) as quantita_disponibile,
  -- Lo stato giacenza si basa sulla quantità TOTALE, non su quella disponibile
  CASE 
    WHEN m.quantita = 0 THEN 'esaurito'
    WHEN m.quantita <= COALESCE(m.quantita_minima, 0) AND m.quantita_minima > 0 THEN 'sotto_scorta'
    ELSE 'disponibile'
  END as stato_giacenza,
  (
    SELECT json_agg(
      json_build_object(
        'id', am.id,
        'squadra_id', s.id,
        'squadra_nome', s.nome,
        'quantita', am.quantita,
        'quantita_restituita', COALESCE(am.quantita_restituita, 0),
        'data_assegnazione', am.data_assegnazione,
        'stato', am.stato
      )
    )
    FROM public.assegnazioni_materiale am
    JOIN public.squadre s ON am.squadra_id = s.id
    WHERE am.materiale_id = m.id 
    AND am.stato IN ('attiva', 'parziale')
    AND am.stagione_id = m.stagione_id
  ) as assegnazioni_attive,
  st.nome as stagione_nome
FROM public.magazzino m
LEFT JOIN public.stagioni_sportive st ON m.stagione_id = st.id;

-- Update comment to reflect the inclusion of foto_url
COMMENT ON VIEW public.v_magazzino_dettaglio IS 'Vista dettagliata articoli magazzino con foto_url. quantita_disponibile = quantità non assegnata, stato_giacenza basato su quantità totale fisica';

-- Grant permissions
GRANT SELECT ON public.v_magazzino_dettaglio TO authenticated;