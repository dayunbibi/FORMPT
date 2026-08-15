-- 대기 중 중복 요청 방지
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_pending_unique
  ON public.join_requests (member_id, trainer_id)
  WHERE status = 'pending';

-- 트레이너가 자신에게 온 요청 + 신청자 프로필(설문 포함)을 조회
CREATE OR REPLACE FUNCTION public.incoming_join_requests()
RETURNS TABLE(
  id uuid,
  member_id uuid,
  status request_status,
  message text,
  created_at timestamptz,
  full_name text,
  phone text,
  goal text,
  injuries text,
  preferred_time text,
  photo_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'trainer') THEN
    RAISE EXCEPTION 'not a trainer';
  END IF;

  RETURN QUERY
    SELECT r.id, r.member_id, r.status, r.message, r.created_at,
           p.full_name, p.phone, p.goal, p.injuries, p.preferred_time, p.photo_path
    FROM public.join_requests r
    JOIN public.profiles p ON p.id = r.member_id
    WHERE r.trainer_id = _uid
      AND r.status = 'pending'
      AND p.deleted_at IS NULL
    ORDER BY r.created_at ASC;
END;
$$;

-- 이름 2글자 이상 검색만 허용 (이름만 반환)
CREATE OR REPLACE FUNCTION public.search_trainers(_term text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _q text := btrim(coalesce(_term, ''));
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF length(_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.full_name
    FROM public.profiles p
    WHERE public.has_role(p.id, 'trainer')
      AND p.id <> _uid
      AND p.full_name ILIKE '%' || _q || '%'
    ORDER BY p.full_name
    LIMIT 20;
END;
$$;

-- 초대코드 사전 확인 (연결하지 않고 트레이너 이름만)
CREATE OR REPLACE FUNCTION public.preview_invite_code(_code text)
RETURNS TABLE(trainer_id uuid, trainer_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _trainer uuid;
  _current uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.trainer_id INTO _current FROM public.profiles p WHERE p.id = _uid;
  IF _current IS NOT NULL THEN
    RAISE EXCEPTION 'already linked';
  END IF;

  SELECT c.trainer_id INTO _trainer
  FROM public.trainer_invite_codes c
  WHERE upper(replace(c.code, ' ', '')) = upper(replace(coalesce(_code, ''), ' ', ''));

  IF _trainer IS NULL OR _trainer = _uid THEN
    RAISE EXCEPTION 'invalid code';
  END IF;

  RETURN QUERY SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = _trainer;
END;
$$;

REVOKE ALL ON FUNCTION public.incoming_join_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_trainers(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incoming_join_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_trainers(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_invite_code(text) TO authenticated;

-- 대기 중인 가입 요청 신청자의 사진만 해당 트레이너가 열람
DROP POLICY IF EXISTS "trainer views pending applicant photo" ON storage.objects;
CREATE POLICY "trainer views pending applicant photo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'member-photos'
  AND EXISTS (
    SELECT 1 FROM public.join_requests r
    WHERE r.trainer_id = auth.uid()
      AND r.status = 'pending'
      AND (storage.foldername(name))[1] = r.member_id::text
  )
);
