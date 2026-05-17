-- Миграция 010: публичное чтение связей между профилями
-- Нужно чтобы /p/[id] могла показывать родственников без авторизации

CREATE POLICY "relationships: публичное чтение"
  ON public.relationships FOR SELECT
  TO anon
  USING (true);
