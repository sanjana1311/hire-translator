CREATE TABLE public.rejection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  imported_job_id uuid REFERENCES public.imported_jobs(id) ON DELETE SET NULL,
  gmail_message_id text NOT NULL,
  company text NOT NULL DEFAULT '',
  role_title text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  evidence_snippet text NOT NULL DEFAULT '',
  email_subject text NOT NULL DEFAULT '',
  sender text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  match_status text NOT NULL DEFAULT 'needs_review',
  explicit_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, gmail_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rejection_events TO authenticated;
GRANT ALL ON public.rejection_events TO service_role;

ALTER TABLE public.rejection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rejection events"
ON public.rejection_events FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_rejection_events_updated_at
BEFORE UPDATE ON public.rejection_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gmail_sync_metadata
  ADD COLUMN IF NOT EXISTS last_rejection_sync_at timestamptz;