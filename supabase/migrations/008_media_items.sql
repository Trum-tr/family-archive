-- Таблица медиафайлов профиля
CREATE TABLE IF NOT EXISTS public.media_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id   UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('note', 'audio', 'video')),
  title       TEXT,
  content     TEXT,   -- текст заметки или URL видео (YouTube/VK)
  file_url    TEXT,   -- URL аудиофайла в Storage
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media: все могут читать"
  ON public.media_items FOR SELECT USING (true);

CREATE POLICY "media: авторизованные создают"
  ON public.media_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "media: авторизованные удаляют"
  ON public.media_items FOR DELETE TO authenticated
  USING (true);

-- Storage bucket для аудио
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Политики storage audio
CREATE POLICY "audio: публичное чтение"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "audio: загрузка для авторизованных"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio' AND auth.uid() IS NOT NULL);
