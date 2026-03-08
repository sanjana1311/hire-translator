
-- Table to track Gmail sync state and store refresh tokens
CREATE TABLE public.gmail_sync_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  last_synced_at timestamptz DEFAULT NULL,
  refresh_token text DEFAULT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_sync_metadata ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own sync metadata
CREATE POLICY "Users can manage own sync metadata"
  ON public.gmail_sync_metadata
  FOR ALL
  TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

-- Trigger for updated_at
CREATE TRIGGER update_gmail_sync_metadata_updated_at
  BEFORE UPDATE ON public.gmail_sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table to store imported jobs so they persist and cron can write to them
CREATE TABLE public.imported_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  location text DEFAULT '',
  url text DEFAULT '',
  source text DEFAULT '',
  snippet text DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false,
  UNIQUE(profile_id, title, company)
);

ALTER TABLE public.imported_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own imported jobs"
  ON public.imported_jobs
  FOR ALL
  TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));
