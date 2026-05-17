-- =====================================================
-- Миграция 002: Storage bucket для фотографий
-- Выполнить в Supabase → SQL Editor
-- =====================================================

-- Создать публичный бакет для фотографий
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- RLS: разрешить аутентифицированным пользователям загружать фото
DROP POLICY IF EXISTS "Auth users can upload photos" ON storage.objects;
CREATE POLICY "Auth users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- RLS: разрешить всем читать фото (публичный доступ для QR-страниц)
DROP POLICY IF EXISTS "Public read photos" ON storage.objects;
CREATE POLICY "Public read photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'photos');

-- RLS: разрешить пользователю удалять свои фото
DROP POLICY IF EXISTS "Auth users can delete own photos" ON storage.objects;
CREATE POLICY "Auth users can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: разрешить пользователю обновлять свои фото
DROP POLICY IF EXISTS "Auth users can update own photos" ON storage.objects;
CREATE POLICY "Auth users can update own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
