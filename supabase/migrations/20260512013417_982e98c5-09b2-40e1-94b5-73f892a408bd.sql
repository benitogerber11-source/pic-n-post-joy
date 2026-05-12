
-- Photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own photos" ON public.photos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own photos" ON public.photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own photos" ON public.photos
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own photo files" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own photo files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own photo files" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);
