ALTER TABLE public.imported_jobs
  ADD COLUMN IF NOT EXISTS source_email_id text,
  ADD COLUMN IF NOT EXISTS listing_index integer,
  ADD COLUMN IF NOT EXISTS listing_hash text,
  ADD COLUMN IF NOT EXISTS import_quality text NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS import_issues jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imported_jobs_import_quality_check'
  ) THEN
    ALTER TABLE public.imported_jobs
      ADD CONSTRAINT imported_jobs_import_quality_check
      CHECK (import_quality IN ('valid', 'needs_review', 'invalid_import'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS imported_jobs_profile_listing_hash_idx
  ON public.imported_jobs (profile_id, listing_hash)
  WHERE listing_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS imported_jobs_profile_quality_idx
  ON public.imported_jobs (profile_id, import_quality);