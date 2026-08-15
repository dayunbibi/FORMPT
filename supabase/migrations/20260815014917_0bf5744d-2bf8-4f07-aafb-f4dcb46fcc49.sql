-- 트레이너 전용 회원 메모 (회원 본인은 조회 불가)
CREATE TABLE IF NOT EXISTS public.member_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_notes TO authenticated;
GRANT ALL ON public.member_notes TO service_role;

ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer manages own member notes" ON public.member_notes;
CREATE POLICY "trainer manages own member notes"
  ON public.member_notes FOR ALL TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid() AND public.is_my_member(member_id));

DROP TRIGGER IF EXISTS member_notes_touch ON public.member_notes;
CREATE TRIGGER member_notes_touch BEFORE UPDATE ON public.member_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 트레이너가 직접 입력하는 운영 지표 (총매출)
CREATE TABLE IF NOT EXISTS public.trainer_metrics (
  trainer_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_revenue bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.trainer_metrics TO authenticated;
GRANT ALL ON public.trainer_metrics TO service_role;

ALTER TABLE public.trainer_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer reads own metrics" ON public.trainer_metrics;
CREATE POLICY "trainer reads own metrics"
  ON public.trainer_metrics FOR SELECT TO authenticated
  USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "trainer inserts own metrics" ON public.trainer_metrics;
CREATE POLICY "trainer inserts own metrics"
  ON public.trainer_metrics FOR INSERT TO authenticated
  WITH CHECK (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'::app_role));

DROP POLICY IF EXISTS "trainer updates own metrics" ON public.trainer_metrics;
CREATE POLICY "trainer updates own metrics"
  ON public.trainer_metrics FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

DROP TRIGGER IF EXISTS trainer_metrics_touch ON public.trainer_metrics;
CREATE TRIGGER trainer_metrics_touch BEFORE UPDATE ON public.trainer_metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();