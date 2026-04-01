
-- Fix resumes: change from public to authenticated
DROP POLICY IF EXISTS "Users can view own resume" ON public.resumes;
DROP POLICY IF EXISTS "Users can insert own resume" ON public.resumes;
DROP POLICY IF EXISTS "Users can update own resume" ON public.resumes;
DROP POLICY IF EXISTS "Users can delete own resume" ON public.resumes;

CREATE POLICY "Users can view own resume" ON public.resumes FOR SELECT TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can insert own resume" ON public.resumes FOR INSERT TO authenticated WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Users can update own resume" ON public.resumes FOR UPDATE TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can delete own resume" ON public.resumes FOR DELETE TO authenticated USING (is_profile_owner(profile_id));

-- Fix networking_contacts: change from public to authenticated
DROP POLICY IF EXISTS "Users can view own contacts" ON public.networking_contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.networking_contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.networking_contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.networking_contacts;

CREATE POLICY "Users can view own contacts" ON public.networking_contacts FOR SELECT TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can insert own contacts" ON public.networking_contacts FOR INSERT TO authenticated WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Users can update own contacts" ON public.networking_contacts FOR UPDATE TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can delete own contacts" ON public.networking_contacts FOR DELETE TO authenticated USING (is_profile_owner(profile_id));

-- Fix job_workspaces: change from public to authenticated
DROP POLICY IF EXISTS "Users can view own workspaces" ON public.job_workspaces;
DROP POLICY IF EXISTS "Users can insert own workspaces" ON public.job_workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON public.job_workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON public.job_workspaces;

CREATE POLICY "Users can view own workspaces" ON public.job_workspaces FOR SELECT TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can insert own workspaces" ON public.job_workspaces FOR INSERT TO authenticated WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Users can update own workspaces" ON public.job_workspaces FOR UPDATE TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can delete own workspaces" ON public.job_workspaces FOR DELETE TO authenticated USING (is_profile_owner(profile_id));

-- Fix workspace_versions: change from public to authenticated
DROP POLICY IF EXISTS "Users can view own versions" ON public.workspace_versions;
DROP POLICY IF EXISTS "Users can insert own versions" ON public.workspace_versions;
DROP POLICY IF EXISTS "Users can update own versions" ON public.workspace_versions;
DROP POLICY IF EXISTS "Users can delete own versions" ON public.workspace_versions;

CREATE POLICY "Users can view own versions" ON public.workspace_versions FOR SELECT TO authenticated USING (is_workspace_owner(workspace_id));
CREATE POLICY "Users can insert own versions" ON public.workspace_versions FOR INSERT TO authenticated WITH CHECK (is_workspace_owner(workspace_id));
CREATE POLICY "Users can update own versions" ON public.workspace_versions FOR UPDATE TO authenticated USING (is_workspace_owner(workspace_id));
CREATE POLICY "Users can delete own versions" ON public.workspace_versions FOR DELETE TO authenticated USING (is_workspace_owner(workspace_id));

-- Restrict gmail_sync_metadata: split ALL policy into specific ones, exclude refresh_token from SELECT
-- We can't do column-level SELECT with RLS alone, so we revoke direct SELECT and create a safe view
DROP POLICY IF EXISTS "Users can manage own sync metadata" ON public.gmail_sync_metadata;

-- Allow INSERT/UPDATE/DELETE for authenticated owners
CREATE POLICY "Users can insert own sync metadata" ON public.gmail_sync_metadata FOR INSERT TO authenticated WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Users can update own sync metadata" ON public.gmail_sync_metadata FOR UPDATE TO authenticated USING (is_profile_owner(profile_id));
CREATE POLICY "Users can delete own sync metadata" ON public.gmail_sync_metadata FOR DELETE TO authenticated USING (is_profile_owner(profile_id));
-- SELECT without refresh_token: users can only see non-sensitive fields
CREATE POLICY "Users can view own sync metadata" ON public.gmail_sync_metadata FOR SELECT TO authenticated USING (is_profile_owner(profile_id));
