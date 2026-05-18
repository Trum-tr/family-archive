-- =====================================================
-- Миграция 005: Починить RLS для загрузки фото
-- Проблема: старая политика требовала approved=true,
-- но новые пользователи не approved → фото не загружались
-- Выполнить в Supabase → SQL Editor
-- =====================================================

-- 1. Исправляем Storage политику загрузки фото
DROP POLICY IF EXISTS "storage photos: загрузка для участников" ON storage.objects;

CREATE POLICY "storage photos: загрузка для участников"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'photos' AND auth.uid() IS NOT NULL
  );

-- 2. Исправляем Storage политику обновления фото
DROP POLICY IF EXISTS "storage photos: обновление для участников" ON storage.objects;

CREATE POLICY "storage photos: обновление для участников"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'photos' AND auth.uid() IS NOT NULL
  );

-- 3. Исправляем политику таблицы photos
DROP POLICY IF EXISTS "photos: участники загружают фото" ON photos;

CREATE POLICY "photos: участники загружают фото"
  ON photos FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND uploaded_by = auth.uid()
  );

-- 4. Исправляем политику UPDATE таблицы photos
DROP POLICY IF EXISTS "photos: модераторы управляют фото" ON photos;

CREATE POLICY "photos: авторизованные управляют своими фото"
  ON photos FOR UPDATE USING (
    auth.uid() = uploaded_by
  );

-- =====================================================
-- КОНЕЦ МИГРАЦИИ 005
-- =====================================================
