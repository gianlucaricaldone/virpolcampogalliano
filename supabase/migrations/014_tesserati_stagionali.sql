-- Creare tabella per dati tesserati specifici per stagione
CREATE TABLE public.tesserati_dati_stagionali (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tesserato_id uuid REFERENCES public.tesserati(id) ON DELETE CASCADE NOT NULL,
  stagione_id uuid REFERENCES public.stagioni_sportive(id) ON DELETE CASCADE NOT NULL,
  stato_pagamento text DEFAULT 'non_pagato' CHECK (stato_pagamento IN ('pagato', 'non_pagato', 'parziale', 'in_sospeso')),
  note_pagamento text,
  visita_sportiva boolean DEFAULT false,
  scadenza_certificato date,
  certificato_medico text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tesserato_id, stagione_id) -- Un record per tesserato per stagione
);

-- Enable RLS
ALTER TABLE public.tesserati_dati_stagionali ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "tesserati_dati_stagionali_select_policy" ON public.tesserati_dati_stagionali FOR SELECT USING (true);
CREATE POLICY "tesserati_dati_stagionali_insert_policy" ON public.tesserati_dati_stagionali FOR INSERT WITH CHECK (true);
CREATE POLICY "tesserati_dati_stagionali_update_policy" ON public.tesserati_dati_stagionali FOR UPDATE USING (true);
CREATE POLICY "tesserati_dati_stagionali_delete_policy" ON public.tesserati_dati_stagionali FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_tesserato ON public.tesserati_dati_stagionali(tesserato_id);
CREATE INDEX IF NOT EXISTS idx_tesserati_dati_stagionali_stagione ON public.tesserati_dati_stagionali(stagione_id);

-- Migra i dati esistenti dalla tabella tesserati alla nuova tabella per la stagione corrente
INSERT INTO public.tesserati_dati_stagionali (
  tesserato_id, 
  stagione_id, 
  stato_pagamento, 
  note_pagamento, 
  visita_sportiva, 
  scadenza_certificato, 
  certificato_medico
)
SELECT 
  t.id,
  (SELECT id FROM public.stagioni_sportive WHERE attiva = true LIMIT 1), -- Stagione corrente
  COALESCE(t.stato_pagamento, 'non_pagato'),
  t.note_pagamento,
  COALESCE(t.visita_sportiva, false),
  t.scadenza_certificato,
  t.certificato_medico
FROM public.tesserati t
WHERE (SELECT id FROM public.stagioni_sportive WHERE attiva = true LIMIT 1) IS NOT NULL; -- Solo se esiste una stagione corrente

-- Ora possiamo rimuovere questi campi dalla tabella tesserati (opzionale, per ora li lasciamo per compatibilità)
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS stato_pagamento;
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS note_pagamento;
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS visita_sportiva;
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS scadenza_certificato;
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS certificato_medico;
-- ALTER TABLE public.tesserati DROP COLUMN IF EXISTS squadra_id;