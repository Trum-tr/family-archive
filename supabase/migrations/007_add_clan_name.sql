-- Добавляем поле "Род" к профилям предков
ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS clan_name TEXT;

-- Комментарий для документации
COMMENT ON COLUMN public.persons.clan_name IS 'Название рода / фамильной ветви (например: Ахмадовы, Джабраиловы)';
