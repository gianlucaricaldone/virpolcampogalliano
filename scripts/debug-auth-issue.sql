-- Script per debuggare il problema di autenticazione
-- Esegui questo script nel SQL Editor di Supabase per diagnosticare il problema

-- 1. Verifica quali trigger esistono su auth.users
SELECT 
  tgname as trigger_name,
  proname as function_name,
  tgenabled as enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- 2. Verifica se ci sono utenti duplicati per email
SELECT 
  email, 
  COUNT(*) as count,
  array_agg(id) as user_ids,
  array_agg(has_logged_in) as login_status,
  array_agg(created_at ORDER BY created_at) as created_dates
FROM public.users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. Verifica utenti in auth.users che non hanno profilo in public.users
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  pu.id as profile_id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- 4. Verifica profili in public.users che non esistono in auth.users (profili orfani)
SELECT 
  pu.id,
  pu.email,
  pu.created_at,
  pu.has_logged_in,
  pu.role
FROM public.users pu
LEFT JOIN auth.users au ON pu.id = au.id
WHERE au.id IS NULL
ORDER BY pu.created_at DESC;

-- 5. Test della funzione trigger (simula inserimento di un nuovo utente auth)
-- ATTENZIONE: Non eseguire se non sei sicuro!
/*
DO $$
DECLARE
  test_email TEXT := 'test-' || gen_random_uuid() || '@example.com';
  test_id UUID := gen_random_uuid();
BEGIN
  -- Simula l'inserimento di un utente auth
  RAISE NOTICE 'Test con email: % e ID: %', test_email, test_id;
  
  -- Chiama direttamente la funzione del trigger
  PERFORM handle_auth_user_created() FROM (
    SELECT 
      test_id as id, 
      test_email as email,
      jsonb_build_object('nome', 'Test', 'cognome', 'User', 'role', 'tesserato') as raw_user_meta_data
  ) as NEW;
  
  -- Verifica se il profilo è stato creato
  IF EXISTS (SELECT 1 FROM public.users WHERE email = test_email) THEN
    RAISE NOTICE 'Profilo creato con successo';
    -- Cleanup
    DELETE FROM public.users WHERE email = test_email;
  ELSE
    RAISE NOTICE 'ERRORE: Profilo non creato';
  END IF;
END $$;
*/

-- 6. Verifica i constraint sulla tabella users
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY conname;