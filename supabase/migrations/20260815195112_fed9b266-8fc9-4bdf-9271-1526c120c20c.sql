-- 이용 종료(구 탈퇴) 회원의 재이용 요청도 트레이너 요청 목록에 노출하고,
-- 이용 종료 날짜와 보류된 PT 횟수를 함께 반환한다.
DROP FUNCTION IF EXISTS public.incoming_join_requests();

CREATE FUNCTION public.incoming_join_requests()
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
  photo_path text,
  ended_at timestamptz,
  held_credits integer
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
           p.full_name, p.phone, p.goal, p.injuries, p.preferred_time, p.photo_path,
           p.deleted_at AS ended_at,
           COALESCE((
             SELECT sum(c.delta)::int FROM public.credit_entries c WHERE c.member_id = p.id
           ), 0) AS held_credits
    FROM public.join_requests r
    JOIN public.profiles p ON p.id = r.member_id
    WHERE r.trainer_id = _uid
      AND r.status = 'pending'
    ORDER BY r.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.incoming_join_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incoming_join_requests() TO authenticated;

CREATE INDEX IF NOT EXISTS profiles_ended_idx ON public.profiles (trainer_id) WHERE deleted_at IS NOT NULL;