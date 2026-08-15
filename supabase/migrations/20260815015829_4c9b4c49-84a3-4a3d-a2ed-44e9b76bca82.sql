-- 1) Storage: 사진 쓰기는 본인만, 조회는 본인+담당 트레이너
DROP POLICY IF EXISTS "member photos insert" ON storage.objects;
DROP POLICY IF EXISTS "member photos update" ON storage.objects;
DROP POLICY IF EXISTS "member photos delete" ON storage.objects;

CREATE POLICY "member photos insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "member photos update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "member photos delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'member-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2) 사진 경로는 본인만 변경 가능
CREATE OR REPLACE FUNCTION public.guard_photo_path_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_path IS DISTINCT FROM OLD.photo_path AND auth.uid() IS NOT NULL AND auth.uid() <> OLD.id THEN
    RAISE EXCEPTION '회원 사진은 회원 본인만 변경할 수 있습니다';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_photo_path_owner ON public.profiles;
CREATE TRIGGER guard_photo_path_owner
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_photo_path_owner();

-- 3) 트레이너 전용 회원 메모
CREATE TABLE IF NOT EXISTS public.trainer_member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_member_notes TO authenticated;
GRANT ALL ON public.trainer_member_notes TO service_role;
ALTER TABLE public.trainer_member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer manages own member notes" ON public.trainer_member_notes FOR ALL TO authenticated
USING (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'))
WITH CHECK (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer') AND public.is_my_member(member_id));

-- 4) 매출 장부
CREATE TABLE IF NOT EXISTS public.revenue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  entry_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revenue_entries_trainer_date_idx ON public.revenue_entries (trainer_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_entries TO authenticated;
GRANT ALL ON public.revenue_entries TO service_role;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer manages own revenue" ON public.revenue_entries FOR ALL TO authenticated
USING (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'))
WITH CHECK (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS touch_trainer_member_notes ON public.trainer_member_notes;
CREATE TRIGGER touch_trainer_member_notes BEFORE UPDATE ON public.trainer_member_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_revenue_entries ON public.revenue_entries;
CREATE TRIGGER touch_revenue_entries BEFORE UPDATE ON public.revenue_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();