-- =====================================================
-- Миграция 003: Исправление схемы persons для Stage 2
-- Выполнить в Supabase → SQL Editor
-- =====================================================

-- 1. Добавляем недостающие колонки в persons
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS middle_name    text,
  ADD COLUMN IF NOT EXISTS main_photo_url text;

-- 2. Делаем first_name и last_name nullable (Stage 2 позволяет пустые)
ALTER TABLE persons
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name  DROP NOT NULL;

-- 3. Убираем старые RLS политики persons (они требовали approved + роль)
DROP POLICY IF EXISTS "persons: публичные записи видны всем"        ON persons;
DROP POLICY IF EXISTS "persons: авторизованные видят всех"          ON persons;
DROP POLICY IF EXISTS "persons: редакторы могут создавать"          ON persons;
DROP POLICY IF EXISTS "persons: редакторы и выше могут обновлять"   ON persons;

-- 4. Простые политики: любой авторизованный = полный доступ к своим записям
CREATE POLICY "persons: авторизованные видят свои"
  ON persons FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "persons: авторизованные создают"
  ON persons FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "persons: авторизованные обновляют свои"
  ON persons FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "persons: авторизованные удаляют свои"
  ON persons FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- 5. Публичный SELECT для страницы /p/[id] (без авторизации)
CREATE POLICY "persons: публичные видны всем"
  ON persons FOR SELECT
  TO public
  USING (true);
