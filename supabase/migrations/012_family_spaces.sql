-- ============================================================
-- 012_family_spaces.sql
-- Multi-tenancy: family_spaces, family_members, invitations
-- RLS policies + is_family_member() helper
-- Migration of existing data into personal family spaces
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
CREATE TYPE family_role AS ENUM ('viewer', 'member', 'editor', 'admin');

-- ────────────────────────────────────────────────────────────
-- TABLE: family_spaces
-- ────────────────────────────────────────────────────────────
CREATE TABLE family_spaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE: family_members
-- ────────────────────────────────────────────────────────────
CREATE TABLE family_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES family_spaces(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       family_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE: invitations
-- ────────────────────────────────────────────────────────────
CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES family_spaces(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        family_role NOT NULL DEFAULT 'member',
  email       TEXT,                        -- optional: pre-fill recipient
  used_by     UUID REFERENCES auth.users(id),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- ADD family_id TO EXISTING TABLES
-- ────────────────────────────────────────────────────────────
ALTER TABLE persons       ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES family_spaces(id) ON DELETE CASCADE;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES family_spaces(id) ON DELETE CASCADE;
ALTER TABLE photos        ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES family_spaces(id) ON DELETE CASCADE;
ALTER TABLE media_items   ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES family_spaces(id) ON DELETE CASCADE;

-- linked_user_id: links auth account to tree profile
ALTER TABLE persons ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_family_members_user_id  ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token        ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_family_id    ON invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_persons_family_id        ON persons(family_id);

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTION: is_family_member()
-- Returns true if current user belongs to the family with at least required_role
-- Role hierarchy: viewer < member < editor < admin
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_family_member(fid UUID, required_role family_role DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM family_members
    WHERE family_id = fid
      AND user_id   = auth.uid()
      AND (
        required_role = 'viewer'
        OR (required_role = 'member' AND role IN ('member','editor','admin'))
        OR (required_role = 'editor' AND role IN ('editor','admin'))
        OR (required_role = 'admin'  AND role = 'admin')
      )
  )
  OR EXISTS (
    SELECT 1 FROM family_spaces
    WHERE id = fid AND created_by = auth.uid()
  );
$$;

-- ────────────────────────────────────────────────────────────
-- ENABLE RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE family_spaces  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items    ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS: family_spaces
-- ────────────────────────────────────────────────────────────
CREATE POLICY "family_spaces_select" ON family_spaces
  FOR SELECT USING (is_family_member(id, 'viewer'));

CREATE POLICY "family_spaces_insert" ON family_spaces
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "family_spaces_update" ON family_spaces
  FOR UPDATE USING (is_family_member(id, 'admin'));

CREATE POLICY "family_spaces_delete" ON family_spaces
  FOR DELETE USING (auth.uid() = created_by);

-- ────────────────────────────────────────────────────────────
-- RLS: family_members
-- ────────────────────────────────────────────────────────────
CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (is_family_member(family_id, 'viewer'));

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (is_family_member(family_id, 'admin'));

CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (is_family_member(family_id, 'admin'));

CREATE POLICY "family_members_delete" ON family_members
  FOR DELETE USING (
    is_family_member(family_id, 'admin')
    OR user_id = auth.uid()   -- user can leave themselves
  );

-- ────────────────────────────────────────────────────────────
-- RLS: invitations
-- ────────────────────────────────────────────────────────────
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (
    is_family_member(family_id, 'editor')
    OR invited_by = auth.uid()
    -- public token lookup (for /invite/[token] page — token known)
    OR (used_by IS NULL AND expires_at > now())
  );

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (is_family_member(family_id, 'editor'));

CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (
    is_family_member(family_id, 'admin')
    OR invited_by = auth.uid()
    -- allow using the invite (update used_by/used_at by anyone with the token)
    OR (used_by IS NULL AND expires_at > now())
  );

CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (is_family_member(family_id, 'admin'));

-- ────────────────────────────────────────────────────────────
-- RLS: persons
-- ────────────────────────────────────────────────────────────
CREATE POLICY "persons_select" ON persons
  FOR SELECT USING (
    -- public profiles are visible without auth
    profile_visibility = 'public'
    -- family profiles visible to family members
    OR (profile_visibility = 'family' AND is_family_member(family_id, 'viewer'))
    -- private only for family members too (admin/editor/member)
    OR (profile_visibility = 'private' AND is_family_member(family_id, 'member'))
    -- owner always sees their own profile
    OR linked_user_id = auth.uid()
    -- legacy: no family_id yet (during migration)
    OR family_id IS NULL
  );

CREATE POLICY "persons_insert" ON persons
  FOR INSERT WITH CHECK (
    is_family_member(family_id, 'editor')
    OR family_id IS NULL  -- legacy
  );

CREATE POLICY "persons_update" ON persons
  FOR UPDATE USING (
    is_family_member(family_id, 'editor')
    OR linked_user_id = auth.uid()  -- owner edits own profile
    OR family_id IS NULL
  );

CREATE POLICY "persons_delete" ON persons
  FOR DELETE USING (
    is_family_member(family_id, 'admin')
    OR family_id IS NULL
  );

-- ────────────────────────────────────────────────────────────
-- RLS: relationships
-- ────────────────────────────────────────────────────────────
CREATE POLICY "relationships_select" ON relationships
  FOR SELECT USING (
    is_family_member(family_id, 'viewer') OR family_id IS NULL
  );

CREATE POLICY "relationships_insert" ON relationships
  FOR INSERT WITH CHECK (
    is_family_member(family_id, 'editor') OR family_id IS NULL
  );

CREATE POLICY "relationships_update" ON relationships
  FOR UPDATE USING (
    is_family_member(family_id, 'editor') OR family_id IS NULL
  );

CREATE POLICY "relationships_delete" ON relationships
  FOR DELETE USING (
    is_family_member(family_id, 'admin') OR family_id IS NULL
  );

-- ────────────────────────────────────────────────────────────
-- RLS: photos
-- ────────────────────────────────────────────────────────────
CREATE POLICY "photos_select" ON photos
  FOR SELECT USING (
    is_family_member(family_id, 'viewer') OR family_id IS NULL
  );

CREATE POLICY "photos_insert" ON photos
  FOR INSERT WITH CHECK (
    is_family_member(family_id, 'member') OR family_id IS NULL
  );

CREATE POLICY "photos_delete" ON photos
  FOR DELETE USING (
    is_family_member(family_id, 'admin') OR family_id IS NULL
  );

-- ────────────────────────────────────────────────────────────
-- RLS: media_items
-- ────────────────────────────────────────────────────────────
CREATE POLICY "media_items_select" ON media_items
  FOR SELECT USING (
    is_family_member(family_id, 'viewer') OR family_id IS NULL
  );

CREATE POLICY "media_items_insert" ON media_items
  FOR INSERT WITH CHECK (
    is_family_member(family_id, 'member') OR family_id IS NULL
  );

CREATE POLICY "media_items_delete" ON media_items
  FOR DELETE USING (
    is_family_member(family_id, 'admin') OR family_id IS NULL
  );

-- ────────────────────────────────────────────────────────────
-- TRIGGER: updated_at on family_spaces
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER family_spaces_updated_at
  BEFORE UPDATE ON family_spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- DATA MIGRATION: create personal family_space for each user
-- and link all their existing persons/relationships/photos/media
-- ────────────────────────────────────────────────────────────

-- Step 1: create one family_space per user who has persons
INSERT INTO family_spaces (name, created_by)
SELECT
  COALESCE(
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p.created_by),
    'Семейный архив'
  ) || ' — семья',
  p.created_by
FROM (
  SELECT DISTINCT created_by FROM persons WHERE created_by IS NOT NULL
) p
ON CONFLICT DO NOTHING;

-- Step 2: add creator as admin of their space
INSERT INTO family_members (family_id, user_id, role)
SELECT fs.id, fs.created_by, 'admin'
FROM family_spaces fs
ON CONFLICT (family_id, user_id) DO NOTHING;

-- Step 3: link persons to family_space
UPDATE persons p
SET family_id = (
  SELECT fs.id FROM family_spaces fs
  WHERE fs.created_by = p.created_by
  LIMIT 1
)
WHERE family_id IS NULL AND created_by IS NOT NULL;

-- Step 4: link relationships
UPDATE relationships r
SET family_id = (
  SELECT p.family_id FROM persons p
  WHERE p.id = r.person1_id AND p.family_id IS NOT NULL
  LIMIT 1
)
WHERE family_id IS NULL;

-- Step 5: link photos
UPDATE photos ph
SET family_id = (
  SELECT p.family_id FROM persons p
  WHERE p.id = ph.person_id AND p.family_id IS NOT NULL
  LIMIT 1
)
WHERE family_id IS NULL;

-- Step 6: link media_items
UPDATE media_items m
SET family_id = (
  SELECT p.family_id FROM persons p
  WHERE p.id = m.person_id AND p.family_id IS NOT NULL
  LIMIT 1
)
WHERE family_id IS NULL;
