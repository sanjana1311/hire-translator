ALTER TABLE public.imported_jobs 
  ADD COLUMN IF NOT EXISTS analysis jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tailored_resume text DEFAULT NULL;