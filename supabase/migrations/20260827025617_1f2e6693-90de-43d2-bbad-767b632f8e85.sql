ALTER TABLE public.imported_jobs
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS imported_jobs_profile_batch_idx
  ON public.imported_jobs (profile_id, import_batch_id);

CREATE INDEX IF NOT EXISTS imported_jobs_profile_imported_at_idx
  ON public.imported_jobs (profile_id, imported_at DESC);