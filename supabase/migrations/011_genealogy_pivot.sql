-- =====================================================
-- Миграция 011: Пивот — от кладбища к генеалогическому дереву
-- Добавляем поддержку живых людей, корня дерева, видимости профиля
-- Выполнить в Supabase → SQL Editor
-- =====================================================

-- 1. Флаг: человек живой или умер (по умолчанию — жив)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_alive BOOLEAN NOT NULL DEFAULT true;

-- 2. Флаг: этот человек — основоположник рода (корень дерева)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT false;

-- 3. Текущий город проживания (для живых)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS current_city TEXT;

-- 4. Видимость профиля: private | family | public
--    private = только авторизованные (владелец/редакторы)
--    family  = по прямой ссылке (без регистрации)
--    public  = полностью открыт
ALTER TABLE persons ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (profile_visibility IN ('private', 'family', 'public'));

-- 5. Умершие по умолчанию становятся public, живые — private
--    (обновляем уже существующие записи у которых есть дата смерти)
UPDATE persons SET is_alive = false, profile_visibility = 'public'
  WHERE death_date IS NOT NULL AND is_alive = true;

-- 6. Индекс для быстрого поиска корня дерева
CREATE INDEX IF NOT EXISTS persons_is_root_idx ON persons(is_root) WHERE is_root = true;

-- 7. Индекс для фильтрации по живым/умершим
CREATE INDEX IF NOT EXISTS persons_is_alive_idx ON persons(is_alive);

-- =====================================================
-- КОНЕЦ МИГРАЦИИ 011
-- =====================================================
