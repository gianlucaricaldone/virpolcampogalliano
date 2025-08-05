-- Sincronizza le email da auth.users a public.users dove mancanti
UPDATE public.users u
SET email = au.email,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND (u.email IS NULL OR u.email = '')
  AND au.email IS NOT NULL;

-- Per gli utenti che ancora non hanno email (probabilmente non esistono in auth.users),
-- genera un'email temporanea basata su nome e cognome
UPDATE public.users
SET email = LOWER(CONCAT(
    COALESCE(REPLACE(nome, ' ', ''), 'utente'),
    '.',
    COALESCE(REPLACE(cognome, ' ', ''), CAST(id AS VARCHAR(8))),
    '@temp.local'
)),
updated_at = NOW()
WHERE email IS NULL OR email = '';

-- Ora possiamo aggiungere il constraint NOT NULL (commentato per sicurezza)
-- ALTER TABLE public.users 
-- ALTER COLUMN email SET NOT NULL;