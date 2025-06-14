-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assegnazioni_materiale (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  materiale_id uuid,
  squadra_id uuid,
  data_assegnazione date NOT NULL,
  data_restituzione date,
  quantita integer NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  stato text DEFAULT 'attiva'::text CHECK (stato = ANY (ARRAY['attiva'::text, 'restituita'::text, 'parziale'::text])),
  quantita_restituita integer DEFAULT 0,
  utente_id uuid,
  stagione_id uuid DEFAULT current_season_id(),
  CONSTRAINT assegnazioni_materiale_pkey PRIMARY KEY (id),
  CONSTRAINT assegnazioni_materiale_materiale_id_fkey FOREIGN KEY (materiale_id) REFERENCES public.magazzino(id),
  CONSTRAINT assegnazioni_materiale_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT assegnazioni_materiale_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES public.users(id),
  CONSTRAINT assegnazioni_materiale_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.avversari (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome_societa text NOT NULL UNIQUE,
  citta text,
  provincia text,
  telefono text,
  email text,
  sito_web text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT avversari_pkey PRIMARY KEY (id)
);
CREATE TABLE public.calendario_campi (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campo_id uuid,
  data date NOT NULL,
  ora_inizio time without time zone NOT NULL,
  ora_fine time without time zone NOT NULL,
  tipo_attivita text NOT NULL,
  squadra_id uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT calendario_campi_pkey PRIMARY KEY (id),
  CONSTRAINT calendario_campi_campo_id_fkey FOREIGN KEY (campo_id) REFERENCES public.campi(id),
  CONSTRAINT calendario_campi_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id)
);
CREATE TABLE public.campi (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL,
  caratteristiche text,
  coordinate text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT campi_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categorie_avversari (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  avversario_id uuid NOT NULL,
  nome_categoria text NOT NULL,
  responsabile_nome text,
  responsabile_telefono text,
  responsabile_email text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT categorie_avversari_pkey PRIMARY KEY (id),
  CONSTRAINT categorie_avversari_avversario_id_fkey FOREIGN KEY (avversario_id) REFERENCES public.avversari(id)
);
CREATE TABLE public.convocazioni (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  partita_id uuid,
  tesserato_id uuid,
  stato text DEFAULT 'convocato'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  stagione_id uuid,
  CONSTRAINT convocazioni_pkey PRIMARY KEY (id),
  CONSTRAINT convocazioni_partita_id_fkey FOREIGN KEY (partita_id) REFERENCES public.partite(id),
  CONSTRAINT convocazioni_tesserato_id_fkey FOREIGN KEY (tesserato_id) REFERENCES public.tesserati(id),
  CONSTRAINT convocazioni_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.eventi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome character varying NOT NULL,
  descrizione text,
  data_evento timestamp with time zone NOT NULL,
  luogo character varying,
  costo_persona numeric,
  max_partecipanti integer,
  note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tipologia character varying DEFAULT 'altro'::character varying,
  CONSTRAINT eventi_pkey PRIMARY KEY (id),
  CONSTRAINT eventi_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.eventi_economici (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  data_evento date NOT NULL,
  tipo text NOT NULL,
  budget_preventivo numeric,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT eventi_economici_pkey PRIMARY KEY (id)
);
CREATE TABLE public.iscrizioni_torneo (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  torneo_id uuid,
  nome_societa text NOT NULL,
  email_contatto text NOT NULL,
  telefono_contatto text,
  numero_squadre integer DEFAULT 1,
  documenti jsonb,
  stato_iscrizione text DEFAULT 'in_attesa'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT iscrizioni_torneo_pkey PRIMARY KEY (id),
  CONSTRAINT iscrizioni_torneo_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.tornei(id)
);
CREATE TABLE public.magazzino (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tipo_materiale text NOT NULL,
  nome_articolo text NOT NULL,
  quantita integer NOT NULL DEFAULT 0,
  stato text DEFAULT 'disponibile'::text,
  ubicazione text,
  codice_tracking text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  quantita_iniziale integer NOT NULL DEFAULT 0,
  quantita_minima integer DEFAULT 0,
  categoria text,
  taglia text,
  colore text,
  stagione_id uuid,
  CONSTRAINT magazzino_pkey PRIMARY KEY (id),
  CONSTRAINT magazzino_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.movimenti_economici (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  evento_id uuid,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrata'::text, 'uscita'::text])),
  categoria text NOT NULL,
  importo numeric NOT NULL,
  descrizione text NOT NULL,
  data_movimento date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT movimenti_economici_pkey PRIMARY KEY (id),
  CONSTRAINT movimenti_economici_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventi_economici(id)
);
CREATE TABLE public.movimenti_magazzino (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  materiale_id uuid NOT NULL,
  tipo_movimento text NOT NULL CHECK (tipo_movimento = ANY (ARRAY['carico'::text, 'scarico'::text, 'assegnazione'::text, 'restituzione'::text, 'rettifica'::text, 'inventario_iniziale'::text])),
  quantita integer NOT NULL,
  quantita_prima integer NOT NULL,
  quantita_dopo integer NOT NULL,
  causale text NOT NULL,
  squadra_id uuid,
  utente_id uuid NOT NULL,
  note text,
  data_movimento timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  stagione_id uuid DEFAULT current_season_id(),
  CONSTRAINT movimenti_magazzino_pkey PRIMARY KEY (id),
  CONSTRAINT movimenti_magazzino_materiale_id_fkey FOREIGN KEY (materiale_id) REFERENCES public.magazzino(id),
  CONSTRAINT movimenti_magazzino_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT movimenti_magazzino_utente_id_fkey FOREIGN KEY (utente_id) REFERENCES public.users(id),
  CONSTRAINT movimenti_magazzino_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.parametri_sistema (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chiave text NOT NULL UNIQUE,
  valore text,
  descrizione text,
  tipo text DEFAULT 'string'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT parametri_sistema_pkey PRIMARY KEY (id)
);
CREATE TABLE public.partite (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  squadra_id uuid,
  data date NOT NULL,
  ora time without time zone NOT NULL,
  campo text NOT NULL,
  avversario text NOT NULL,
  risultato text,
  tipo_competizione text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  categoria_avversario_id uuid,
  stagione_id uuid,
  CONSTRAINT partite_pkey PRIMARY KEY (id),
  CONSTRAINT partite_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT partite_categoria_avversario_id_fkey FOREIGN KEY (categoria_avversario_id) REFERENCES public.categorie_avversari(id),
  CONSTRAINT partite_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.prenotazioni_eventi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL,
  nome_partecipante character varying NOT NULL,
  email character varying,
  telefono character varying,
  note text,
  confermato boolean DEFAULT false,
  presente boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  no_maiale boolean DEFAULT false,
  vegetariano_vegano boolean DEFAULT false,
  celiaco boolean DEFAULT false,
  CONSTRAINT prenotazioni_eventi_pkey PRIMARY KEY (id),
  CONSTRAINT prenotazioni_eventi_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventi(id)
);
CREATE TABLE public.presenze (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tesserato_id uuid,
  data date NOT NULL,
  tipo USER-DEFINED NOT NULL,
  presente boolean DEFAULT false,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  squadra_id uuid,
  stagione_id uuid,
  CONSTRAINT presenze_pkey PRIMARY KEY (id),
  CONSTRAINT presenze_tesserato_id_fkey FOREIGN KEY (tesserato_id) REFERENCES public.tesserati(id),
  CONSTRAINT presenze_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT presenze_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.report_allenatori (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  allenatore_id uuid,
  squadra_id uuid,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo_attivita USER-DEFINED NOT NULL,
  report text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT report_allenatori_pkey PRIMARY KEY (id),
  CONSTRAINT report_allenatori_allenatore_id_fkey FOREIGN KEY (allenatore_id) REFERENCES public.users(id),
  CONSTRAINT report_allenatori_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id)
);
CREATE TABLE public.report_mensili (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  allenatore_id uuid NOT NULL,
  squadra_id uuid,
  mese integer NOT NULL CHECK (mese >= 1 AND mese <= 12),
  anno integer NOT NULL CHECK (anno >= 2020 AND anno <= 2030),
  report text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  stagione_id uuid,
  CONSTRAINT report_mensili_pkey PRIMARY KEY (id),
  CONSTRAINT report_mensili_allenatore_id_fkey FOREIGN KEY (allenatore_id) REFERENCES public.users(id),
  CONSTRAINT report_mensili_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT report_mensili_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.squadre (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  categoria text NOT NULL,
  annata integer NOT NULL,
  foto_squadra text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  vice_allenatore_1 text,
  vice_allenatore_2 text,
  vice_allenatore_1_id uuid,
  vice_allenatore_2_id uuid,
  allenatore text,
  allenatore_id uuid,
  dirigente text,
  dirigente_id uuid,
  stagione_id uuid,
  CONSTRAINT squadre_pkey PRIMARY KEY (id),
  CONSTRAINT squadre_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.stagioni_sportive (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL UNIQUE,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  attiva boolean DEFAULT false,
  archiviata boolean DEFAULT false,
  descrizione text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT stagioni_sportive_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tesserati (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  cognome text NOT NULL,
  data_nascita date,
  codice_fiscale text UNIQUE,
  squadra_id uuid,
  ruolo_squadra text,
  email text,
  telefono text,
  indirizzo text,
  citta text,
  cap text,
  documento_identita text,
  certificato_medico text,
  scadenza_certificato date,
  stato_pagamento USER-DEFINED DEFAULT 'non_pagato'::stato_pagamento,
  note_pagamento text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  stato boolean NOT NULL DEFAULT true,
  codice_cartellino text,
  visita_sportiva boolean DEFAULT false,
  CONSTRAINT tesserati_pkey PRIMARY KEY (id),
  CONSTRAINT tesserati_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id)
);
CREATE TABLE public.tesserati_dati_stagionali (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tesserato_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  stato_pagamento text DEFAULT 'non_pagato'::text CHECK (stato_pagamento = ANY (ARRAY['pagato'::text, 'non_pagato'::text, 'parziale'::text, 'in_sospeso'::text])),
  note_pagamento text,
  visita_sportiva boolean DEFAULT false,
  scadenza_certificato date,
  certificato_medico text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tesserati_dati_stagionali_pkey PRIMARY KEY (id),
  CONSTRAINT tesserati_dati_stagionali_tesserato_id_fkey FOREIGN KEY (tesserato_id) REFERENCES public.tesserati(id),
  CONSTRAINT tesserati_dati_stagionali_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.tesserati_squadre_stagioni (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tesserato_id uuid NOT NULL,
  squadra_id uuid NOT NULL,
  stagione_id uuid NOT NULL,
  ruolo_squadra text,
  numero_maglia integer,
  data_tesseramento date,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tesserati_squadre_stagioni_pkey PRIMARY KEY (id),
  CONSTRAINT tesserati_squadre_stagioni_tesserato_id_fkey FOREIGN KEY (tesserato_id) REFERENCES public.tesserati(id),
  CONSTRAINT tesserati_squadre_stagioni_squadra_id_fkey FOREIGN KEY (squadra_id) REFERENCES public.squadre(id),
  CONSTRAINT tesserati_squadre_stagioni_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.tornei (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  stato text DEFAULT 'pianificato'::text,
  regolamento jsonb,
  costo_iscrizione numeric,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  attivo boolean DEFAULT true,
  iscrizioni_aperte boolean DEFAULT false,
  descrizione text,
  immagine_copertina text,
  numero_squadre_max integer,
  numero_squadre_iscritte integer DEFAULT 0,
  luogo text,
  contatto_email text,
  contatto_telefono text,
  stagione_id uuid,
  CONSTRAINT tornei_pkey PRIMARY KEY (id),
  CONSTRAINT tornei_stagione_id_fkey FOREIGN KEY (stagione_id) REFERENCES public.stagioni_sportive(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text UNIQUE,
  role USER-DEFINED DEFAULT 'tesserato'::user_role,
  squadra_id ARRAY DEFAULT ARRAY[]::uuid[],
  nome text,
  cognome text,
  telefono text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  roles ARRAY DEFAULT ARRAY['tesserato'::user_role],
  has_logged_in boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);