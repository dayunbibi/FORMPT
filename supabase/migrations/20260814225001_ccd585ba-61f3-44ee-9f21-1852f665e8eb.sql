REVOKE ALL ON FUNCTION public.my_trainer_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_trainer_id() TO authenticated;

REVOKE ALL ON FUNCTION public.list_trainers() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_trainers() TO authenticated;

REVOKE ALL ON FUNCTION public.taken_slots(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.taken_slots(uuid, date) TO authenticated;

REVOKE ALL ON FUNCTION public.is_my_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_my_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;