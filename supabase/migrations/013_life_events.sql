-- ============================================================
-- 013_life_events.sql
-- Chronological life events for persons
-- ============================================================

CREATE TYPE life_event_type AS ENUM (
  'birth',
  'death',
  'education',
  'graduation',
  'work_start',
  'work_end',
  'emigration',
  'relocation',
  'marriage',
  'divorce',
  'military_service',
  'military_end',
  'award',
  'achievement',
  'other'
);

CREATE TABLE life_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  family_id   UUID REFERENCES family_spaces(id) ON DELETE CASCADE,
  event_type  life_event_type NOT NULL DEFAULT 'other',
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE,             -- full date if known
  event_year  INT,              -- year only (when exact date unknown)
  location    TEXT,             -- city or place
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_life_events_person_id ON life_events(person_id);
CREATE INDEX IF NOT EXISTS idx_life_events_family_id ON life_events(family_id);
CREATE INDEX IF NOT EXISTS idx_life_events_date      ON life_events(event_year NULLS LAST, event_date NULLS LAST);

-- Auto-fill family_id from person
CREATE OR REPLACE FUNCTION life_events_set_family_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.family_id IS NULL THEN
    SELECT family_id INTO NEW.family_id FROM persons WHERE id = NEW.person_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER life_events_family_id_trigger
  BEFORE INSERT ON life_events
  FOR EACH ROW EXECUTE FUNCTION life_events_set_family_id();

-- updated_at trigger
CREATE TRIGGER life_events_updated_at
  BEFORE UPDATE ON life_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "life_events_select" ON life_events
  FOR SELECT USING (
    is_family_member(family_id, 'viewer') OR family_id IS NULL
  );

CREATE POLICY "life_events_insert" ON life_events
  FOR INSERT WITH CHECK (
    is_family_member(family_id, 'member') OR family_id IS NULL
  );

CREATE POLICY "life_events_update" ON life_events
  FOR UPDATE USING (
    is_family_member(family_id, 'editor')
    OR created_by = auth.uid()
    OR family_id IS NULL
  );

CREATE POLICY "life_events_delete" ON life_events
  FOR DELETE USING (
    is_family_member(family_id, 'editor')
    OR created_by = auth.uid()
    OR family_id IS NULL
  );
