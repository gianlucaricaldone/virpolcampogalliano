-- Aggiunge il nuovo ruolo "vice_allenatore" e supporto per 2 vice allenatori per squadra

-- Aggiungi il nuovo ruolo all'enum
ALTER TYPE user_role ADD VALUE 'vice_allenatore';

-- Modifica la tabella squadre per supportare allenatori, vice allenatori e dirigenti
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS allenatore text;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS allenatore_id uuid;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS vice_allenatore_1 text;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS vice_allenatore_2 text;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS vice_allenatore_1_id uuid;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS vice_allenatore_2_id uuid;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS dirigente text;
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS dirigente_id uuid;

-- Aggiorna la vista delle statistiche presenze se necessario
-- (la vista dovrebbe già funzionare con i nuovi ruoli)

-- Commento: I vice allenatori possono essere:
-- - Utenti con ruolo 'allenatore' 
-- - Utenti con ruolo 'vice_allenatore'
-- Questo sarà gestito a livello applicativo nei form