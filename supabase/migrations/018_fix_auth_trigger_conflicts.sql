-- Fix per risolvere i conflitti tra i trigger di autenticazione
-- Il problema è che ci sono multipli trigger che tentano di creare profili utente

-- Prima rimuoviamo tutti i trigger esistenti
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_link_profile ON auth.users;

-- Rimuoviamo anche le funzioni vecchie per evitare confusione
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Creiamo una nuova funzione unificata che gestisce tutti i casi
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger AS $$
DECLARE
  existing_user_id uuid;
BEGIN
  -- Prima controlla se esiste già un profilo con questa email
  SELECT id INTO existing_user_id 
  FROM public.users 
  WHERE email = NEW.email
  LIMIT 1;
  
  IF existing_user_id IS NOT NULL THEN
    -- Se il profilo esiste già e ha un ID diverso (probabilmente creato manualmente)
    IF existing_user_id != NEW.id THEN
      -- Se il profilo esistente non ha mai fatto login (has_logged_in = false)
      -- allora aggiorniamo l'ID per collegarlo all'account auth
      IF EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = existing_user_id 
        AND (has_logged_in = false OR has_logged_in IS NULL)
      ) THEN
        -- Aggiorna il profilo esistente con il nuovo ID auth
        UPDATE public.users 
        SET 
          id = NEW.id,
          has_logged_in = true,
          updated_at = now()
        WHERE id = existing_user_id;
        
        RAISE NOTICE 'Profilo esistente aggiornato per email %', NEW.email;
      ELSE
        -- Se il profilo ha già fatto login, c'è un conflitto
        -- Non possiamo avere due account auth per la stessa email
        RAISE EXCEPTION 'Un utente con email % esiste già e ha già effettuato l''accesso', NEW.email;
      END IF;
    END IF;
    -- Se l'ID corrisponde già, non fare nulla
  ELSE
    -- Se non esiste un profilo, creane uno nuovo
    INSERT INTO public.users (
      id, 
      email, 
      nome,
      cognome,
      role, 
      roles,
      has_logged_in,
      created_at, 
      updated_at
    ) VALUES (
      NEW.id, 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nome', ''),
      COALESCE(NEW.raw_user_meta_data->>'cognome', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'tesserato'),
      ARRAY[COALESCE(NEW.raw_user_meta_data->>'role', 'tesserato')]::user_role[],
      true,
      now(),
      now()
    );
    
    RAISE NOTICE 'Nuovo profilo creato per email %', NEW.email;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Se c'è una violazione di unicità, probabilmente l'email esiste già
    -- Proviamo ad aggiornare il profilo esistente
    UPDATE public.users 
    SET 
      id = NEW.id,
      has_logged_in = true,
      updated_at = now()
    WHERE email = NEW.email
    AND (has_logged_in = false OR has_logged_in IS NULL);
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Impossibile creare o aggiornare il profilo per %', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea un singolo trigger unificato
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_auth_user_created();

-- Aggiungiamo anche un indice sull'email per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Commento per documentazione
COMMENT ON FUNCTION public.handle_auth_user_created() IS 
'Gestisce la creazione/collegamento dei profili utente quando un nuovo utente si autentica. 
Se esiste già un profilo con la stessa email che non ha mai fatto login, lo collega all''account auth.
Altrimenti crea un nuovo profilo.';