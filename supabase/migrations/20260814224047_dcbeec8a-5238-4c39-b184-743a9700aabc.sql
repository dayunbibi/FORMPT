-- 1) 이름만 노출하는 트레이너 디렉터리 함수
CREATE OR REPLACE FUNCTION public.list_trainers()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE public.has_role(p.id, 'trainer')
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_trainers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_trainers() TO authenticated;

-- 2) 트레이너 프로필 전체 행 공개 정책 제거 (연락처/부상이력 유출 방지)
DROP POLICY IF EXISTS "trainer profiles visible" ON public.profiles;

-- 3) 회원은 자신의 담당 트레이너 프로필만 조회 가능
CREATE POLICY "member reads assigned trainer"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (SELECT me.trainer_id FROM public.profiles me WHERE me.id = auth.uid())
);
