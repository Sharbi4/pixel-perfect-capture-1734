REVOKE EXECUTE ON FUNCTION public.can_manage_salon(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_salon(uuid, uuid) TO authenticated;