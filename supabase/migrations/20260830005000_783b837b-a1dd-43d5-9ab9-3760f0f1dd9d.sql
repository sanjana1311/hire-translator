REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_profile_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid) FROM PUBLIC;

-- RLS policies evaluate these predicates as the signed-in caller, so they must stay callable.
GRANT EXECUTE ON FUNCTION public.is_profile_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid) TO authenticated;