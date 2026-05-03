
ALTER FUNCTION public.award_xp(integer) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.award_xp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(integer) TO authenticated;
