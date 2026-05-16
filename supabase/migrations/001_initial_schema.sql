-- =============================================================================
-- Цифровой семейный архив — начальная схема базы данных
-- Миграция: 001_initial_schema.sql
-- Безопасна для повторного запуска (IF NOT EXISTS везде)
-- =============================================================================


-- =============================================================================
-- 1. ТАБЛИЦЫ
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text,
  phone        text,
  role         text        NOT NULL DEFAULT 'participant',
  approved     boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  approved_by  uuid        REFERENCES auth.users(id),
  approved_at  timestamptz,
  CONSTRAINT profiles_role_check CHECK (
    role IN ('guest', 'participant', 'editor', 'moderator', 'admin')
  )
);

CREATE TABLE IF NOT EXISTS persons (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name   text        NOT NULL,
  last_name    text        NOT NULL,
  patronymic   text,
  birth_date   date,
  death_date   date,
  birth_place  text,
  biography    text,
  burial_place text,
  burial_lat   numeric(10,7),
  burial_lng   numeric(10,7),
  is_published boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person1_id    uuid        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id    uuid        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type text        NOT NULL,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relationships_relation_type_check CHECK (
    relation_type IN ('parent', 'child', 'spouse', 'sibling', 'adopted')
  ),
  CONSTRAINT relationships_no_self_ref CHECK (person1_id <> person2_id)
);

CREATE TABLE IF NOT EXISTS photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    uuid        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  caption      text,
  taken_year   integer,
  taken_place  text,
  is_primary   boolean     NOT NULL DEFAULT false,
  is_approved  boolean     NOT NULL DEFAULT false,
  uploaded_by  uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photos_taken_year_check CHECK (
    taken_year IS NULL OR (taken_year >= 1800 AND taken_year <= 2100)
  )
);

CREATE TABLE IF NOT EXISTS edits (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  field_name    text        NOT NULL,
  old_value     text,
  new_value     text,
  proposed_by   uuid        REFERENCES auth.users(id),
  status        text        NOT NULL DEFAULT 'pending',
  votes_for     integer     NOT NULL DEFAULT 0,
  votes_against integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid        REFERENCES auth.users(id),
  CONSTRAINT edits_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  )
);

CREATE TABLE IF NOT EXISTS votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_id    uuid        NOT NULL REFERENCES edits(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id),
  vote       boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_unique_per_user UNIQUE (edit_id, user_id)
);


-- =============================================================================
-- 2. ИНДЕКСЫ
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_persons_last_name    ON persons (last_name);
CREATE INDEX IF NOT EXISTS idx_persons_created_by   ON persons (created_by);
CREATE INDEX IF NOT EXISTS idx_persons_published     ON persons (is_published);
CREATE INDEX IF NOT EXISTS idx_relationships_person1 ON relationships (person1_id);
CREATE INDEX IF NOT EXISTS idx_relationships_person2 ON relationships (person2_id);
CREATE INDEX IF NOT EXISTS idx_edits_person_id       ON edits (person_id);
CREATE INDEX IF NOT EXISTS idx_edits_status          ON edits (status);
CREATE INDEX IF NOT EXISTS idx_photos_person_id      ON photos (person_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id      ON profiles (user_id);


-- =============================================================================
-- 3. ТРИГГЕРЫ
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS persons_updated_at ON persons;
CREATE TRIGGER persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, phone, full_name)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =============================================================================
-- 4. STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE edits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes         ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 6. RLS ПОЛИТИКИ — profiles
-- =============================================================================

DROP POLICY IF EXISTS "profiles: пользователь видит свой профиль"      ON profiles;
DROP POLICY IF EXISTS "profiles: модераторы и админы видят все"         ON profiles;
DROP POLICY IF EXISTS "profiles: пользователь редактирует свой профиль" ON profiles;
DROP POLICY IF EXISTS "profiles: модератор управляет профилями"         ON profiles;

CREATE POLICY "profiles: пользователь видит свой профиль"
  ON profiles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles: модераторы и админы видят все"
  ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

CREATE POLICY "profiles: пользователь редактирует свой профиль"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "profiles: модератор управляет профилями"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );


-- =============================================================================
-- 7. RLS ПОЛИТИКИ — persons
-- =============================================================================

DROP POLICY IF EXISTS "persons: публичные записи видны всем"    ON persons;
DROP POLICY IF EXISTS "persons: авторизованные видят всех"      ON persons;
DROP POLICY IF EXISTS "persons: редакторы могут создавать"      ON persons;
DROP POLICY IF EXISTS "persons: редакторы и выше могут обновлять" ON persons;

CREATE POLICY "persons: публичные записи видны всем"
  ON persons FOR SELECT USING (is_published = true);

CREATE POLICY "persons: авторизованные видят всех"
  ON persons FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
  );

CREATE POLICY "persons: редакторы могут создавать"
  ON persons FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('editor', 'moderator', 'admin'))
  );

CREATE POLICY "persons: редакторы и выше могут обновлять"
  ON persons FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('editor', 'moderator', 'admin'))
  );


-- =============================================================================
-- 8. RLS ПОЛИТИКИ — relationships
-- =============================================================================

DROP POLICY IF EXISTS "relationships: публичные связи видны всем"       ON relationships;
DROP POLICY IF EXISTS "relationships: авторизованные видят все связи"   ON relationships;
DROP POLICY IF EXISTS "relationships: редакторы добавляют связи"        ON relationships;

CREATE POLICY "relationships: публичные связи видны всем"
  ON relationships FOR SELECT USING (
    EXISTS (SELECT 1 FROM persons WHERE id = person1_id AND is_published = true) AND
    EXISTS (SELECT 1 FROM persons WHERE id = person2_id AND is_published = true)
  );

CREATE POLICY "relationships: авторизованные видят все связи"
  ON relationships FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
  );

CREATE POLICY "relationships: редакторы добавляют связи"
  ON relationships FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('editor', 'moderator', 'admin'))
  );


-- =============================================================================
-- 9. RLS ПОЛИТИКИ — photos
-- =============================================================================

DROP POLICY IF EXISTS "photos: публичные фото видны всем"      ON photos;
DROP POLICY IF EXISTS "photos: авторизованные видят все фото"  ON photos;
DROP POLICY IF EXISTS "photos: участники загружают фото"       ON photos;
DROP POLICY IF EXISTS "photos: модераторы управляют фото"      ON photos;

CREATE POLICY "photos: публичные фото видны всем"
  ON photos FOR SELECT USING (
    is_approved = true AND
    EXISTS (SELECT 1 FROM persons WHERE id = person_id AND is_published = true)
  );

CREATE POLICY "photos: авторизованные видят все фото"
  ON photos FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
  );

CREATE POLICY "photos: участники загружают фото"
  ON photos FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('participant', 'editor', 'moderator', 'admin'))
  );

CREATE POLICY "photos: модераторы управляют фото"
  ON photos FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );


-- =============================================================================
-- 10. RLS ПОЛИТИКИ — edits
-- =============================================================================

DROP POLICY IF EXISTS "edits: авторизованные видят правки"     ON edits;
DROP POLICY IF EXISTS "edits: участники предлагают правки"     ON edits;
DROP POLICY IF EXISTS "edits: модераторы разрешают/отклоняют" ON edits;

CREATE POLICY "edits: авторизованные видят правки"
  ON edits FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
  );

CREATE POLICY "edits: участники предлагают правки"
  ON edits FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('participant', 'editor', 'moderator', 'admin'))
  );

CREATE POLICY "edits: модераторы разрешают/отклоняют"
  ON edits FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );


-- =============================================================================
-- 11. RLS ПОЛИТИКИ — votes
-- =============================================================================

DROP POLICY IF EXISTS "votes: авторизованные видят голоса"  ON votes;
DROP POLICY IF EXISTS "votes: участники голосуют"           ON votes;
DROP POLICY IF EXISTS "votes: участник меняет свой голос"  ON votes;
DROP POLICY IF EXISTS "votes: участник удаляет свой голос" ON votes;

CREATE POLICY "votes: авторизованные видят голоса"
  ON votes FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true)
  );

CREATE POLICY "votes: участники голосуют"
  ON votes FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('participant', 'editor', 'moderator', 'admin'))
  );

CREATE POLICY "votes: участник меняет свой голос"
  ON votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "votes: участник удаляет свой голос"
  ON votes FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- 12. STORAGE RLS — bucket photos
-- =============================================================================

DROP POLICY IF EXISTS "storage photos: публичный просмотр"      ON storage.objects;
DROP POLICY IF EXISTS "storage photos: загрузка для участников" ON storage.objects;
DROP POLICY IF EXISTS "storage photos: удаление для модераторов" ON storage.objects;

CREATE POLICY "storage photos: публичный просмотр"
  ON storage.objects FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "storage photos: загрузка для участников"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'photos' AND auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.approved = true AND p.role IN ('participant', 'editor', 'moderator', 'admin'))
  );

CREATE POLICY "storage photos: удаление для модераторов"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'photos' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('moderator', 'admin'))
    )
  );


-- =============================================================================
-- КОНЕЦ МИГРАЦИИ
-- =============================================================================
