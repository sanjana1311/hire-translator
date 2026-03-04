
-- Add new columns for the redesigned 5-step pipeline
ALTER TABLE public.job_workspaces
  ADD COLUMN IF NOT EXISTS match_bucket text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS tailored_resume jsonb DEFAULT '{}'::jsonb;
