-- =====================================================
-- Миграция 004: Починить триггер создания профиля
-- Выполнить в Supabase → SQL Editor
-- =====================================================

-- 1. Пересоздаём триггерную функцию с явной схемой, EXCEPTION-обработчиком
--    и правильным search_path (важно для SECURITY DEFINER в Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone, full_name)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Не блокируем создание пользователя если профиль не создался
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Добавляем INSERT-политику для profiles (триггер идёт через postgres,
--    но в некоторых конфигурациях Supabase всё равно нужна политика)
DROP POLICY IF EXISTS "profiles: вставка своего профиля" ON profiles;
CREATE POLICY "profiles: вставка своего профиля"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. На случай если пользователь уже существует в auth.users
--    без записи в profiles — создаём профиль вручную
INSERT INTO public.profiles (user_id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- КОНЕЦ МИГРАЦИИ 004
-- =====================================================
