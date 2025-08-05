-- Query da eseguire nel SQL Editor di Supabase
-- per sincronizzare squadra_id degli allenatori

-- 1. Prima verifichiamo chi sono gli utenti con squadra assegnata ma squadra_id vuoto
SELECT 
  u.nome,
  u.cognome,
  u.email,
  u.role,
  u.squadra_id,
  s.id as squadra_id_dovrebbe_essere,
  s.nome as squadra_nome
FROM public.users u
LEFT JOIN public.squadre s ON (s.allenatore_id = u.id OR s.vice_allenatore_1_id = u.id OR s.vice_allenatore_2_id = u.id)
WHERE s.id IS NOT NULL -- Ha una squadra assegnata
  AND (u.squadra_id IS NULL OR u.squadra_id = '{}') -- Ma squadra_id è vuoto
ORDER BY u.cognome, u.nome;

-- 2. Aggiorna gli allenatori principali (qualsiasi ruolo)
UPDATE public.users u
SET 
  squadra_id = ARRAY[s.id],
  updated_at = NOW()
FROM public.squadre s
WHERE s.allenatore_id = u.id
  AND (u.squadra_id IS NULL OR u.squadra_id = '{}');

-- 3. Aggiorna i vice allenatori 1 (qualsiasi ruolo)
UPDATE public.users u
SET 
  squadra_id = CASE 
    WHEN u.squadra_id IS NULL OR u.squadra_id = '{}' THEN ARRAY[s.id]
    ELSE array_append(u.squadra_id, s.id)
  END,
  updated_at = NOW()
FROM public.squadre s
WHERE s.vice_allenatore_1_id = u.id
  AND NOT (s.id = ANY(COALESCE(u.squadra_id, '{}')));

-- 4. Aggiorna i vice allenatori 2 (qualsiasi ruolo)
UPDATE public.users u
SET 
  squadra_id = CASE 
    WHEN u.squadra_id IS NULL OR u.squadra_id = '{}' THEN ARRAY[s.id]
    ELSE array_append(u.squadra_id, s.id)
  END,
  updated_at = NOW()
FROM public.squadre s
WHERE s.vice_allenatore_2_id = u.id
  AND NOT (s.id = ANY(COALESCE(u.squadra_id, '{}')));

-- 5. Verifica finale - mostra tutti gli utenti con squadre assegnate
SELECT 
  u.nome,
  u.cognome,
  u.email,
  u.role,
  u.squadra_id,
  array_agg(DISTINCT s.nome) as squadre_nomi
FROM public.users u
LEFT JOIN public.squadre s ON s.id = ANY(u.squadra_id)
WHERE u.squadra_id IS NOT NULL AND u.squadra_id != '{}'
GROUP BY u.id, u.nome, u.cognome, u.email, u.role, u.squadra_id
ORDER BY u.cognome, u.nome;