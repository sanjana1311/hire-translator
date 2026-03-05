ALTER TABLE public.job_workspaces DROP CONSTRAINT job_workspaces_status_check;
ALTER TABLE public.job_workspaces ADD CONSTRAINT job_workspaces_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'analyzing'::text, 'signals_ready'::text, 'scored'::text, 'weak_match'::text, 'ready'::text, 'applied'::text]));