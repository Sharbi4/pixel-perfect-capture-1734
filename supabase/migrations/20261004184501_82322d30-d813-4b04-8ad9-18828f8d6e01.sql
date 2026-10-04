REVOKE EXECUTE ON FUNCTION public.add_salon_owner_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_salon_member(uuid, uuid) FROM PUBLIC, anon;