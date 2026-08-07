CREATE TABLE public.networking_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  imported_job_id uuid REFERENCES public.imported_jobs(id) ON DELETE CASCADE,
  job_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  location text DEFAULT '',
  name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  target_company text NOT NULL DEFAULT '',
  connection_type text NOT NULL DEFAULT 'industry_connection',
  match_reason text NOT NULL DEFAULT '',
  evidence text DEFAULT '',
  linkedin_url text DEFAULT '',
  search_url text DEFAULT '',
  relevance integer NOT NULL DEFAULT 0,
  outreach_message text DEFAULT '',
  source text NOT NULL DEFAULT 'suggested',
  status text NOT NULL DEFAULT 'not_contacted',
  notes text DEFAULT '',
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.networking_targets TO authenticated;
GRANT ALL ON public.networking_targets TO service_role;
ALTER TABLE public.networking_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own networking targets"
ON public.networking_targets FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_networking_targets_updated_at
BEFORE UPDATE ON public.networking_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_networking_targets_job ON public.networking_targets (profile_id, imported_job_id);

CREATE TABLE public.linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_name text DEFAULT '',
  headline text DEFAULT '',
  profile_url text DEFAULT '',
  access_token text,
  expires_at timestamptz,
  scopes text DEFAULT '',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.linkedin_accounts TO service_role;
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_linkedin_accounts_updated_at
BEFORE UPDATE ON public.linkedin_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();