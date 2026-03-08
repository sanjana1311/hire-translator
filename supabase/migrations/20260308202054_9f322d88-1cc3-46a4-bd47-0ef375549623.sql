
-- Add missing columns to imported_jobs
ALTER TABLE public.imported_jobs
  ADD COLUMN IF NOT EXISTS salary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS url_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_fetched_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_email_subject text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

-- Add unique constraint for deduplication
ALTER TABLE public.imported_jobs
  ADD CONSTRAINT imported_jobs_profile_title_company_unique UNIQUE (profile_id, title, company);
