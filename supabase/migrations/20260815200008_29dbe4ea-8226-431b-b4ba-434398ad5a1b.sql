CREATE OR REPLACE FUNCTION public.preview_invite_code(_code text)
 RETURNS TABLE(trainer_id uuid, trainer_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _trainer uuid;
  _current uuid;
  _ended timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.trainer_id, p.deleted_at INTO _current, _ended FROM public.profiles p WHERE p.id = _uid;
  -- 이용이 종료된 회원은 미연결 회원과 동일하게 코드로 다시 연결할 수 있다.
  IF _current IS NOT NULL AND _ended IS NULL THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
 RETURNS TABLE(trainer_id uuid, trainer_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _trainer uuid;
  _current uuid;
  _ended timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.trainer_id, p.deleted_at INTO _current, _ended FROM public.profiles p WHERE p.id = _uid;
  IF _current IS NOT NULL AND _ended IS NULL THEN
    RAISE EXCEPTION 'already linked';
  END IF;

  SELECT c.trainer_id INTO _trainer
  FROM public.trainer_invite_codes c
  WHERE upper(replace(c.code, ' ', '')) = upper(replace(coalesce(_code, ''), ' ', ''));

  IF _trainer IS NULL OR _trainer = _uid THEN
    RAISE EXCEPTION 'invalid code';
  END IF;

  UPDATE public.profiles
     SET trainer_id = _trainer,
         deleted_at = NULL,
         deleted_by = NULL,
         deleted_reason = NULL
   WHERE id = _uid;

  UPDATE public.join_requests
     SET status = 'approved'
   WHERE member_id = _uid AND trainer_id = _trainer AND status = 'pending';

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_trainer, '새 회원이 연결되었습니다', (SELECT full_name FROM public.profiles WHERE id = _uid) || ' 님이 초대 코드로 연결되었습니다.');

  RETURN QUERY
    SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = _trainer;
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_invite_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;