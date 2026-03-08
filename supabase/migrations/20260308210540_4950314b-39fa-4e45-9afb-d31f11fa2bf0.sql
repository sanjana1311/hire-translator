CREATE TABLE public.role_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_seed_id integer NOT NULL,
  score integer NOT NULL DEFAULT 0,
  bucket text NOT NULL DEFAULT 'low',
  match_summary text,
  strengths jsonb DEFAULT '[]'::jsonb,
  gaps jsonb DEFAULT '[]'::jsonb,
  missing_keywords jsonb DEFAULT '[]'::jsonb,
  tailored_resume text,
  error boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, job_seed_id)
);

ALTER TABLE public.role_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON public.role_analyses FOR SELECT TO authenticated
  USING (is_profile_owner(profile_id));

CREATE POLICY "Users can insert own analyses"
  ON public.role_analyses FOR INSERT TO authenticated
  WITH CHECK (is_profile_owner(profile_id));

CREATE POLICY "Users can update own analyses"
  ON public.role_analyses FOR UPDATE TO authenticated
  USING (is_profile_owner(profile_id));

CREATE POLICY "Users can delete own analyses"
  ON public.role_analyses FOR DELETE TO authenticated
  USING (is_profile_owner(profile_id));