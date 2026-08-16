CREATE TABLE public.job_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  imported_job_id UUID NOT NULL REFERENCES public.imported_jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  score INTEGER NOT NULL DEFAULT 0,
  bucket TEXT NOT NULL DEFAULT 'low',
  match_summary TEXT,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT,
  analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX job_scores_unique_key ON public.job_scores (profile_id, imported_job_id, COALESCE(resume_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX job_scores_profile_idx ON public.job_scores (profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_scores TO authenticated;
GRANT ALL ON public.job_scores TO service_role;

ALTER TABLE public.job_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own job scores"
ON public.job_scores FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_job_scores_updated_at
BEFORE UPDATE ON public.job_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();