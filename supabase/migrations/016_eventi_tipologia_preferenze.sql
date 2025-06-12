-- Aggiungere tipologia agli eventi
ALTER TABLE public.eventi
ADD COLUMN tipologia VARCHAR(50) DEFAULT 'altro';

-- Aggiungere preferenze alimentari alle prenotazioni
ALTER TABLE public.prenotazioni_eventi
ADD COLUMN no_maiale BOOLEAN DEFAULT FALSE,
ADD COLUMN vegetariano_vegano BOOLEAN DEFAULT FALSE,
ADD COLUMN celiaco BOOLEAN DEFAULT FALSE;

-- Aggiornare gli eventi esistenti per avere una tipologia
UPDATE public.eventi SET tipologia = 'altro' WHERE tipologia IS NULL;