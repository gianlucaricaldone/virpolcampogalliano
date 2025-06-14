-- Add foto_url field to magazzino table for article images

-- Add column for storing image URL
ALTER TABLE public.magazzino 
ADD COLUMN IF NOT EXISTS foto_url text;

-- Create storage bucket for magazzino images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('magazzino', 'magazzino', true, false, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage bucket
CREATE POLICY "Public Access for magazzino images" ON storage.objects
FOR SELECT USING (bucket_id = 'magazzino');

CREATE POLICY "Authenticated users can upload magazzino images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'magazzino' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
);

CREATE POLICY "Authenticated users can update magazzino images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'magazzino' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
);

CREATE POLICY "Authenticated users can delete magazzino images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'magazzino' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
);

-- Add comment for documentation
COMMENT ON COLUMN public.magazzino.foto_url IS 'URL dell''immagine dell''articolo caricata su Supabase Storage';