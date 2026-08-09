CREATE TABLE public.application_status_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL,
  source text NOT NULL DEFAULT 'Manual update',
  entered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_status_events TO authenticated;
GRANT ALL ON public.application_status_events TO service_role;

ALTER TABLE public.application_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their status events"
ON public.application_status_events FOR SELECT TO authenticated
USING (public.is_profile_owner(profile_id));

CREATE POLICY "Owners can insert their status events"
ON public.application_status_events FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Owners can update their status events"
ON public.application_status_events FOR UPDATE TO authenticated
USING (public.is_profile_owner(profile_id));

CREATE POLICY "Owners can delete their status events"
ON public.application_status_events FOR DELETE TO authenticated
USING (public.is_profile_owner(profile_id));

CREATE INDEX idx_app_status_events_app ON public.application_status_events(application_id, created_at);

INSERT INTO public.application_status_events (application_id, profile_id, status, source, entered_at, created_at)
SELECT a.id, a.profile_id, a.status, 'Imported', COALESCE(a.applied_date::timestamptz, a.created_at), a.created_at
FROM public.applications a;