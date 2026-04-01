
-- Remove the overly permissive SELECT policy on access_requests
DROP POLICY IF EXISTS "Authenticated users can view requests" ON public.access_requests;

-- Remove the overly permissive INSERT policy (WITH CHECK true) and replace with anon-only insert
DROP POLICY IF EXISTS "Anyone can submit access request" ON public.access_requests;

-- Re-create INSERT policy: anyone (anon or authenticated) can submit, but no one can read
CREATE POLICY "Anyone can submit access request"
  ON public.access_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
