-- Aggiorna il trigger per gestire meglio la sincronizzazione tra auth.users e public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Prima controlla se l'utente esiste già in public.users
  -- (potrebbe essere stato creato manualmente prima dell'account auth)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = new.id OR email = new.email) THEN
    -- Aggiorna l'utente esistente con l'ID corretto e l'email dall'auth
    UPDATE public.users 
    SET 
      id = new.id,
      email = new.email,
      updated_at = NOW()
    WHERE email = new.email OR id = new.id;
  ELSE
    -- Crea un nuovo utente
    INSERT INTO public.users (id, email, role, created_at, updated_at)
    VALUES (
      new.id, 
      new.email,
      'tesserato', -- default role
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi il trigger esistente se esiste
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Ricrea il trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();