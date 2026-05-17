-- Таблица фотогалереи профиля
CREATE TABLE IF NOT EXISTS public.photos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id   UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos: все могут читать"
  ON public.photos FOR SELECT USING (true);

CREATE POLICY "photos: авторизованные создают"
  ON public.photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "photos: авторизованные удаляют"
  ON public.photos FOR DELETE TO authenticated USING (true);
