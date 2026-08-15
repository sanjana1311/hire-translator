ALTER TABLE public.gmail_sync_metadata
  ADD COLUMN IF NOT EXISTS last_sync_status text,
  ADD COLUMN IF NOT EXISTS last_sync_summary jsonb,
  ADD COLUMN IF NOT EXISTS last_sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text;