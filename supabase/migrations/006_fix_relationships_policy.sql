-- =====================================================
-- Миграция 006: Починить RLS для таблицы relationships
-- Проблема: старые политики требовали approved=true
-- Выполнить в Supabase → SQL Editor
-- =====================================================

DROP POLICY IF EXISTS "relationships: публичные связи видны всем"     ON relationships;
DROP POLICY IF EXISTS "relationships: авторизованные видят все связи" ON relationships;
DROP POLICY IF EXISTS "relationships: редакторы добавляют связи"      ON relationships;

-- Любой авторизованный видит все связи
CREATE POLICY "relationships: авторизованные видят"
  ON relationships FOR SELECT
  TO authenticated
  USING (true);

-- Любой авторизованный может добавлять связи
CREATE POLICY "relationships: авторизованные создают"
  ON relationships FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Автор может обновлять свои связи
CREATE POLICY "relationships: авторизованные обновляют свои"
  ON relationships FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Автор может удалять свои связи
CREATE POLICY "relationships: авторизованные удаляют свои"
  ON relationships FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- КОНЕЦ МИГРАЦИИ 006
-- =====================================================
