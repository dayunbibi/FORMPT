DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM ('requested','needs_info','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code text,
  reason_text text,
  remaining_at_request integer NOT NULL DEFAULT 0,
  upcoming_at_request integer NOT NULL DEFAULT 0,
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  trainer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_open
  ON public.withdrawal_requests (member_id)
  WHERE status IN ('requested','needs_info');

CREATE INDEX IF NOT EXISTS withdrawal_requests_trainer_idx
  ON public.withdrawal_requests (trainer_id, status);

DROP POLICY IF EXISTS "member creates own withdrawal request" ON public.withdrawal_requests;
CREATE POLICY "member creates own withdrawal request" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND trainer_id = public.my_trainer_id()
    AND status = 'requested'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.deleted_at IS NULL AND p.suspended = false
    )
  );

DROP POLICY IF EXISTS "member reads own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "member reads own withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (member_id = auth.uid());

DROP POLICY IF EXISTS "member cancels own withdrawal request" ON public.withdrawal_requests;
CREATE POLICY "member cancels own withdrawal request" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (member_id = auth.uid() AND status IN ('requested','needs_info'))
  WITH CHECK (member_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS "trainer reads withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "trainer reads withdrawal requests" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "trainer updates withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "trainer updates withdrawal requests" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'))
  WITH CHECK (trainer_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));

DROP TRIGGER IF EXISTS touch_withdrawal_requests ON public.withdrawal_requests;
CREATE TRIGGER touch_withdrawal_requests
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();