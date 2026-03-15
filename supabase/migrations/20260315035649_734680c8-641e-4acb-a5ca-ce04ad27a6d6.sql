
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  linkedin_url text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone (even unauthenticated) to insert
CREATE POLICY "Anyone can submit access request"
  ON public.access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can view (admin use)
CREATE POLICY "Authenticated users can view requests"
  ON public.access_requests
  FOR SELECT
  TO authenticated
  USING (true);
