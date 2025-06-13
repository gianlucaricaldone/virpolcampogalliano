-- Script di pulizia per sistemare eventuali utenti duplicati o con problemi

-- 1. Identifica utenti duplicati per email
CREATE TEMP TABLE duplicate_emails AS
SELECT email, COUNT(*) as count
FROM public.users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- 2. Per ogni email duplicata, mantieni solo quello che ha fatto login (o il più recente)
DO $$
DECLARE
  dup_email TEXT;
  keep_id UUID;
BEGIN
  FOR dup_email IN SELECT email FROM duplicate_emails LOOP
    -- Trova l'ID da mantenere (priorità a chi ha fatto login)
    SELECT id INTO keep_id
    FROM public.users
    WHERE email = dup_email
    ORDER BY 
      has_logged_in DESC NULLS LAST,  -- Prima chi ha fatto login
      created_at DESC                   -- Poi il più recente
    LIMIT 1;
    
    -- Elimina tutti gli altri
    DELETE FROM public.users
    WHERE email = dup_email
    AND id != keep_id;
    
    RAISE NOTICE 'Rimossi duplicati per email: %, mantenuto ID: %', dup_email, keep_id;
  END LOOP;
END $$;

-- 3. Sistema gli utenti che esistono in auth.users ma non in public.users
INSERT INTO public.users (id, email, role, roles, has_logged_in, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'tesserato',
  ARRAY['tesserato']::user_role[],
  true,
  au.created_at,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Aggiungi constraint per prevenire futuri duplicati
-- Prima rimuovi eventuali constraint esistenti
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Poi aggiungi il nuovo constraint
ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- 5. Report finale
DO $$
DECLARE
  auth_count INT;
  profile_count INT;
  orphan_profiles INT;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.users;
  SELECT COUNT(*) INTO orphan_profiles 
  FROM public.users u 
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);
  
  RAISE NOTICE 'Report finale:';
  RAISE NOTICE '- Utenti in auth.users: %', auth_count;
  RAISE NOTICE '- Profili in public.users: %', profile_count;
  RAISE NOTICE '- Profili orfani (senza auth): %', orphan_profiles;
END $$;

-- Cleanup
DROP TABLE duplicate_emails;