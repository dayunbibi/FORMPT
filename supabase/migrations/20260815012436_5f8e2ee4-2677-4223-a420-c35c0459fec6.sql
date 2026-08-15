ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS renewal_dismissed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'renewal_status') THEN
    CREATE TYPE public.renewal_status AS ENUM ('requested','contacted','renewed','declined');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.renewal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remaining_at_request integer NOT NULL DEFAULT 0,
  status public.renewal_status NOT NULL DEFAULT 'requested',
  member_note text,
  trainer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.renewal_requests TO authenticated;
GRANT ALL ON public.renewal_requests TO service_role;
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS renewal_requests_one_open_per_member
  ON public.renewal_requests (member_id)
  WHERE status IN ('requested','contacted');

DROP POLICY IF EXISTS "member reads own renewal requests" ON public.renewal_requests;
CREATE POLICY "member reads own renewal requests" ON public.renewal_requests
  FOR SELECT TO authenticated USING (member_id = auth.uid());

DROP POLICY IF EXISTS "member creates own renewal requests" ON public.renewal_requests;
CREATE POLICY "member creates own renewal requests" ON public.renewal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = auth.uid()
    AND trainer_id = public.my_trainer_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.deleted_at IS NULL AND p.suspended = false)
  );

DROP POLICY IF EXISTS "trainer reads renewal requests" ON public.renewal_requests;
CREATE POLICY "trainer reads renewal requests" ON public.renewal_requests
  FOR SELECT TO authenticated USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "trainer updates renewal requests" ON public.renewal_requests;
CREATE POLICY "trainer updates renewal requests" ON public.renewal_requests
  FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS renewal_requests_touch ON public.renewal_requests;
CREATE TRIGGER renewal_requests_touch BEFORE UPDATE ON public.renewal_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.block_inactive_member_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _deleted timestamptz;
  _suspended boolean;
BEGIN
  SELECT p.deleted_at, p.suspended INTO _deleted, _suspended
  FROM public.profiles p WHERE p.id = NEW.member_id;

  IF _deleted IS NOT NULL THEN
    RAISE EXCEPTION 'member is deleted';
  END IF;
  IF _suspended THEN
    RAISE EXCEPTION 'member is suspended';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_block_inactive_member ON public.bookings;
CREATE TRIGGER bookings_block_inactive_member BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.block_inactive_member_booking();

DROP POLICY IF EXISTS "member photos read" ON storage.objects;
CREATE POLICY "member photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_my_member(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );

DROP POLICY IF EXISTS "member photos insert" ON storage.objects;
CREATE POLICY "member photos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_my_member(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );

DROP POLICY IF EXISTS "member photos update" ON storage.objects;
CREATE POLICY "member photos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_my_member(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );

DROP POLICY IF EXISTS "member photos delete" ON storage.objects;
CREATE POLICY "member photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_my_member(nullif((storage.foldername(name))[1], '')::uuid)
    )
  );

ALTER TABLE public.credit_entries ALTER COLUMN amount_paid DROP NOT NULL;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.block_inactive_member_booking() FROM anon, authenticated;