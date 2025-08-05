-- Sincronizza squadra_id per allenatori e vice_allenatori
-- Questa migration aggiorna il campo squadra_id nella tabella users
-- per tutti gli allenatori e vice_allenatori che attualmente hanno questo campo vuoto

-- Prima di tutto, verifichiamo la situazione attuale
DO $$
BEGIN
  RAISE NOTICE 'Allenatori con squadra_id vuoto: %', (
    SELECT COUNT(*) 
    FROM public.users u
    WHERE u.role IN ('allenatore', 'vice_allenatore')
    AND (u.squadra_id IS NULL OR u.squadra_id = '{}')
  );
END $$;

-- Aggiorna gli allenatori principali
UPDATE public.users u
SET 
  squadra_id = ARRAY[s.id],
  updated_at = NOW()
FROM public.squadre s
WHERE s.allenatore_id = u.id
  AND u.role IN ('allenatore', 'vice_allenatore')
  AND (u.squadra_id IS NULL OR u.squadra_id = '{}');

-- Aggiorna i vice allenatori
-- Se un vice allenatore è già stato aggiornato come allenatore principale,
-- aggiungiamo la squadra al suo array esistente
UPDATE public.users u
SET 
  squadra_id = CASE 
    WHEN u.squadra_id IS NULL OR u.squadra_id = '{}' THEN ARRAY[s.id]
    ELSE array_append(u.squadra_id, s.id)
  END,
  updated_at = NOW()
FROM public.squadre s
WHERE s.vice_allenatore_id = u.id
  AND u.role IN ('allenatore', 'vice_allenatore')
  AND NOT (s.id = ANY(COALESCE(u.squadra_id, '{}')));

-- Verifica finale
DO $$
BEGIN
  RAISE NOTICE 'Allenatori aggiornati - con squadra_id ora popolato: %', (
    SELECT COUNT(*) 
    FROM public.users u
    WHERE u.role IN ('allenatore', 'vice_allenatore')
    AND u.squadra_id IS NOT NULL 
    AND u.squadra_id != '{}'
  );
  
  RAISE NOTICE 'Allenatori ancora con squadra_id vuoto: %', (
    SELECT COUNT(*) 
    FROM public.users u
    WHERE u.role IN ('allenatore', 'vice_allenatore')
    AND (u.squadra_id IS NULL OR u.squadra_id = '{}')
  );
END $$;

-- Mostra i dettagli degli aggiornamenti per debug
SELECT 
  u.nome,
  u.cognome,
  u.email,
  u.role,
  u.squadra_id,
  array_agg(s.nome) as squadre_nomi
FROM public.users u
LEFT JOIN public.squadre s ON s.id = ANY(u.squadra_id)
WHERE u.role IN ('allenatore', 'vice_allenatore')
GROUP BY u.id, u.nome, u.cognome, u.email, u.role, u.squadra_id
ORDER BY u.cognome, u.nome;