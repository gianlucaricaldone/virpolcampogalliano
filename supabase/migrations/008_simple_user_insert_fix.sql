-- Soluzione più semplice: aggiungi solo le policy necessarie per permettere agli admin di creare utenti
-- senza modificare la struttura della tabella

-- Rendi la colonna email nullable per permettere creazione senza email
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Rimuovi il constraint di foreign key per permettere UUID temporanei
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Aggiungi un campo per tracciare se l'utente si è mai autenticato
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_logged_in boolean DEFAULT false;

-- Policy per permettere agli admin di inserire nuovi utenti
CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT WITH CHECK (
    -- Permetti se l'utente corrente è admin
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (roles IS NOT NULL AND 'admin' = ANY(roles))
      )
    )
  );

-- Policy per permettere agli admin di aggiornare qualsiasi utente (oltre alla propria)
CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE USING (
    auth.uid() = id  -- Può aggiornare il proprio profilo
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (roles IS NOT NULL AND 'admin' = ANY(roles))
      )
    )
  );

-- Policy per permettere agli admin di eliminare utenti
CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (roles IS NOT NULL AND 'admin' = ANY(roles))
      )
    )
  );

-- Funzione per creare utenti con UUID temporaneo
CREATE OR REPLACE FUNCTION create_user_with_temp_id()
RETURNS trigger AS $$
BEGIN
  -- Se l'ID è NULL, genera un UUID temporaneo
  IF NEW.id IS NULL THEN
    NEW.id = gen_random_uuid();
    NEW.has_logged_in = false;
  ELSE
    NEW.has_logged_in = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per gestire la creazione di utenti con ID temporaneo
DROP TRIGGER IF EXISTS on_user_insert_handle_temp_id ON public.users;
CREATE TRIGGER on_user_insert_handle_temp_id
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_user_with_temp_id();

-- Funzione per collegare profilo esistente quando utente si autentica
CREATE OR REPLACE FUNCTION link_existing_profile()
RETURNS trigger AS $$
DECLARE
  existing_user_id uuid;
BEGIN
  -- Se nei metadati c'è un profile_link_id, cerca quell'utente
  IF NEW.raw_user_meta_data->>'profile_link_id' IS NOT NULL THEN
    SELECT id INTO existing_user_id 
    FROM public.users 
    WHERE id::text = NEW.raw_user_meta_data->>'profile_link_id'
    AND has_logged_in = false;
    
    IF existing_user_id IS NOT NULL THEN
      -- Aggiorna il profilo esistente
      UPDATE public.users 
      SET 
        id = NEW.id,
        has_logged_in = true,
        updated_at = now()
      WHERE id = existing_user_id;
      
      -- Elimina il record auth appena creato perché useremo quello esistente
      DELETE FROM auth.users WHERE id = NEW.id;
      
      RETURN NULL; -- Non inserire il nuovo record
    END IF;
  END IF;
  
  -- Se esiste un profilo con la stessa email ma non autenticato
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = NEW.email 
    AND has_logged_in = false
  ) THEN
    -- Aggiorna il profilo esistente con l'ID di autenticazione
    UPDATE public.users 
    SET 
      id = NEW.id,
      has_logged_in = true,
      updated_at = now()
    WHERE email = NEW.email 
    AND has_logged_in = false;
  ELSE
    -- Crea nuovo profilo se non esiste
    INSERT INTO public.users (
      id, email, nome, cognome, role, roles, has_logged_in, created_at, updated_at
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per collegare profilo esistente all'autenticazione
DROP TRIGGER IF EXISTS on_auth_user_created_link_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_link_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_existing_profile();