-- Create schema for managing opponent teams and their categories

-- Create avversari table (opponent organizations)
CREATE TABLE public.avversari (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome_societa text NOT NULL UNIQUE,
  citta text,
  provincia text,
  telefono text,
  email text,
  sito_web text,
  note text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create categorie_avversari table (opponent team categories)
CREATE TABLE public.categorie_avversari (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  avversario_id uuid REFERENCES public.avversari(id) ON DELETE CASCADE NOT NULL,
  nome_categoria text NOT NULL, -- e.g. "Pulcini", "Esordienti", etc.
  responsabile_nome text,
  responsabile_telefono text,
  responsabile_email text,
  note text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(avversario_id, nome_categoria)
);

-- Update partite table to reference categorie_avversari instead of free text
ALTER TABLE public.partite 
ADD COLUMN IF NOT EXISTS categoria_avversario_id uuid REFERENCES public.categorie_avversari(id);

-- Keep the old avversario field for backward compatibility during migration
-- In the future, we can remove it and use only categoria_avversario_id

-- Enable RLS
ALTER TABLE public.avversari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorie_avversari ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for avversari
CREATE POLICY "avversari_select_policy" ON public.avversari FOR SELECT USING (true);
CREATE POLICY "avversari_insert_policy" ON public.avversari FOR INSERT WITH CHECK (true);
CREATE POLICY "avversari_update_policy" ON public.avversari FOR UPDATE USING (true);
CREATE POLICY "avversari_delete_policy" ON public.avversari FOR DELETE USING (true);

-- Create RLS policies for categorie_avversari
CREATE POLICY "categorie_avversari_select_policy" ON public.categorie_avversari FOR SELECT USING (true);
CREATE POLICY "categorie_avversari_insert_policy" ON public.categorie_avversari FOR INSERT WITH CHECK (true);
CREATE POLICY "categorie_avversari_update_policy" ON public.categorie_avversari FOR UPDATE USING (true);
CREATE POLICY "categorie_avversari_delete_policy" ON public.categorie_avversari FOR DELETE USING (true);