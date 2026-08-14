-- Harden SECURITY DEFINER functions: remove public/anon execute, add explicit auth checks

REVOKE ALL ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_my_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_trainer_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_trainers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.taken_slots(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_invite_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_invite_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_my_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_trainer_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_trainers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;

-- gen_invite_code should never be callable via the API
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE sql
SET search_path TO 'public'
AS $function$
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)+1)::int, 1), '')
  FROM generate_series(1, 8);
$function$;
REVOKE ALL ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;

-- list_trainers: only signed-in users, and only trainer id + name
CREATE OR REPLACE FUNCTION public.list_trainers()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name
    FROM public.profiles p
    WHERE public.has_role(p.id, 'trainer')
    ORDER BY p.full_name;
END;
$function$;
REVOKE ALL ON FUNCTION public.list_trainers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trainers() TO authenticated;

-- taken_slots: only signed-in users; only the caller's own trainer, own schedule, or a trainer they requested to join
CREATE OR REPLACE FUNCTION public.taken_slots(_trainer_id uuid, _day date)
RETURNS TABLE(start_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    _trainer_id = _uid
    OR _trainer_id = public.my_trainer_id()
    OR EXISTS (
      SELECT 1 FROM public.join_requests r
      WHERE r.member_id = _uid AND r.trainer_id = _trainer_id
    )
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
    SELECT b.start_at FROM public.bookings b
    WHERE b.trainer_id = _trainer_id
      AND b.status IN ('pending','confirmed','completed')
      AND (b.start_at AT TIME ZONE 'UTC')::date BETWEEN _day - 1 AND _day + 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.taken_slots(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, date) TO authenticated;