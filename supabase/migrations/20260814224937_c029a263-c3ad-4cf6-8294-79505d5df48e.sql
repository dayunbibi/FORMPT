CREATE OR REPLACE FUNCTION public.my_trainer_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.trainer_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

DROP POLICY IF EXISTS "member reads assigned trainer" ON public.profiles;

CREATE POLICY "member reads assigned trainer"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = public.my_trainer_id());