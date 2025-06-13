-- Enable password authentication for existing users
-- This migration adds a default password for users who don't have one

-- First, ensure email auth is enabled in addition to magic links
-- This needs to be done in the Supabase Dashboard under Authentication > Settings

-- Add a function to set a temporary password for users without one
CREATE OR REPLACE FUNCTION set_temp_password_for_users()
RETURNS void AS $$
DECLARE
    user_record record;
    temp_password text;
BEGIN
    -- Per ogni utente nel sistema senza password (solo magic link)
    FOR user_record IN 
        SELECT u.id, u.email, p.nome, p.cognome 
        FROM auth.users u
        JOIN public.users p ON u.id = p.id
        WHERE u.encrypted_password IS NULL OR u.encrypted_password = ''
    LOOP
        -- Genera una password temporanea basata su nome+cognome
        temp_password := LOWER(COALESCE(user_record.nome, 'user')) || 
                        LOWER(COALESCE(user_record.cognome, '2024'));
        
        -- Log dell'operazione
        RAISE NOTICE 'Setting temp password for user % (%): %', 
            user_record.email, user_record.id, temp_password;
        
        -- Aggiorna la password usando la funzione di Supabase
        -- Questa operazione deve essere fatta manualmente per ora
        -- UPDATE auth.users SET encrypted_password = crypt(temp_password, gen_salt('bf'))
        -- WHERE id = user_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Commento le istruzioni per l'admin
COMMENT ON FUNCTION set_temp_password_for_users() IS '
IMPORTANTE: Per abilitare il login con password:

1. Dashboard Supabase > Authentication > Settings
   - Abilitare "Email" provider (non solo magic link)
   - Mantenere abilitato anche "Enable email confirmations"

2. Per impostare password agli utenti esistenti, eseguire manualmente:
   
   -- Per ogni utente, eseguire:
   UPDATE auth.users 
   SET encrypted_password = crypt(''password_temporanea'', gen_salt(''bf''))
   WHERE email = ''user@example.com'';

3. Password temporanee suggerite:
   - Admin: admin2024
   - Altri: nome+cognome (es. mario+rossi = mariorossi)

4. Gli utenti possono poi cambiare la password dal dashboard
';

-- NOTA: Vista disabilitata a causa di problemi con RLS e accesso auth.users
-- La funzionalità è stata implementata direttamente nel codice usando la tabella users

-- Crea una vista per vedere quali utenti hanno password impostata
-- CREATE OR REPLACE VIEW public.v_users_auth_status AS
-- SELECT 
--     u.id,
--     u.email,
--     p.nome,
--     p.cognome,
--     p.role,
--     CASE 
--         WHEN u.encrypted_password IS NOT NULL AND u.encrypted_password != '' 
--         THEN 'password_set'
--         ELSE 'magic_link_only'
--     END as auth_method,
--     u.created_at,
--     u.last_sign_in_at
-- FROM auth.users u
-- JOIN public.users p ON u.id = p.id
-- ORDER BY u.created_at DESC;

-- Aggiungi RLS alla vista
-- ALTER VIEW public.v_users_auth_status OWNER TO postgres;
-- GRANT SELECT ON public.v_users_auth_status TO authenticated;

-- Solo admin possono vedere lo status di autenticazione
-- CREATE POLICY "Admin can view auth status" ON public.v_users_auth_status
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM public.users 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );