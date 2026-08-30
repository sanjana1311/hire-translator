-- linkedin_accounts: RLS was enabled but no policies existed, locking the table entirely.
CREATE POLICY "Users manage their own linkedin account"
ON public.linkedin_accounts
FOR ALL
TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

-- Trigger-only functions should not be callable through the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
-- Helper predicates are only needed by signed-in users evaluating RLS.
REVOKE EXECUTE ON FUNCTION public.is_profile_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid) FROM anon;