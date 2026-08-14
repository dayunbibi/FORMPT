CREATE OR REPLACE FUNCTION public.taken_slots(_trainer_id uuid, _day date)
RETURNS TABLE (start_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.start_at FROM public.bookings b
  WHERE b.trainer_id = _trainer_id
    AND b.status IN ('pending','confirmed','completed')
    AND (b.start_at AT TIME ZONE 'UTC')::date BETWEEN _day - 1 AND _day + 1;
$$;
REVOKE EXECUTE ON FUNCTION public.taken_slots(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, date) TO authenticated, service_role;