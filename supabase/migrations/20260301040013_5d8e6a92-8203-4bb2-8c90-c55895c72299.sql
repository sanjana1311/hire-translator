ALTER TABLE public.job_workspaces 
ADD COLUMN baseline_score integer DEFAULT 0,
ADD COLUMN score_delta integer DEFAULT 0,
ADD COLUMN gap_analysis jsonb DEFAULT '{}'::jsonb;