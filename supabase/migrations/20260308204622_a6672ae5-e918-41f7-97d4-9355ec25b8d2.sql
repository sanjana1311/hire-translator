CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_seed_id integer,
  imported_job_id uuid REFERENCES public.imported_jobs(id),
  title text NOT NULL,
  company text NOT NULL,
  applied_date date DEFAULT current_date,
  status text NOT NULL DEFAULT 'applied',
  last_email_date date,
  recruiter_email text,
  next_action text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (is_profile_owner(profile_id));

CREATE POLICY "Users can insert own applications"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (is_profile_owner(profile_id));

CREATE POLICY "Users can update own applications"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (is_profile_owner(profile_id));

CREATE POLICY "Users can delete own applications"
  ON public.applications FOR DELETE
  TO authenticated
  USING (is_profile_owner(profile_id));