-- 초대 코드 저장 테이블 (앱에서 직접 SELECT 불가, 보안 함수로만 접근)
CREATE TABLE public.trainer_invite_codes (
  trainer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.trainer_invite_codes TO service_role;

ALTER TABLE public.trainer_invite_codes ENABLE ROW LEVEL SECURITY;
-- 정책 없음: authenticated/anon 은 직접 접근 불가. 아래 security definer 함수만 사용.

CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)+1)::int, 1), '')
  FROM generate_series(1, 8);
$$;

-- 트레이너 본인 코드 조회 (없으면 생성)
CREATE OR REPLACE FUNCTION public.my_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'trainer') THEN
    RAISE EXCEPTION 'not a trainer';
  END IF;

  SELECT code INTO _code FROM public.trainer_invite_codes WHERE trainer_id = _uid;
  IF _code IS NOT NULL THEN
    RETURN _code;
  END IF;

  LOOP
    BEGIN
      _code := public.gen_invite_code();
      INSERT INTO public.trainer_invite_codes (trainer_id, code) VALUES (_uid, _code);
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      -- 코드 충돌 시 재시도
    END;
  END LOOP;
END;
$$;

-- 트레이너 코드 재발급
CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'trainer') THEN
    RAISE EXCEPTION 'not a trainer';
  END IF;

  LOOP
    BEGIN
      _code := public.gen_invite_code();
      INSERT INTO public.trainer_invite_codes (trainer_id, code)
      VALUES (_uid, _code)
      ON CONFLICT (trainer_id) DO UPDATE SET code = EXCLUDED.code, updated_at = now();
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      -- 코드 충돌 시 재시도
    END;
  END LOOP;
END;
$$;

-- 회원이 초대 코드로 트레이너와 즉시 연결. 트레이너 이름만 반환.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS TABLE(trainer_id uuid, trainer_name text)
LANGUAGE plpgsql
VOLATILE
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

  UPDATE public.profiles SET trainer_id = _trainer WHERE id = _uid;

  UPDATE public.join_requests
     SET status = 'approved'
   WHERE member_id = _uid AND trainer_id = _trainer AND status = 'pending';

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_trainer, '새 회원이 연결되었습니다', (SELECT full_name FROM public.profiles WHERE id = _uid) || ' 님이 초대 코드로 연결되었습니다.');

  RETURN QUERY
    SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = _trainer;
END;
$$;

REVOKE ALL ON FUNCTION public.gen_invite_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;