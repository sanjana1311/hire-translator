
CREATE TABLE public.networking_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_seed_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'alumni',
  status TEXT NOT NULL DEFAULT 'not_contacted',
  contacted_date DATE,
  follow_up_date DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.networking_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts" ON public.networking_contacts FOR SELECT USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can insert own contacts" ON public.networking_contacts FOR INSERT WITH CHECK (public.is_profile_owner(profile_id));
CREATE POLICY "Users can update own contacts" ON public.networking_contacts FOR UPDATE USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can delete own contacts" ON public.networking_contacts FOR DELETE USING (public.is_profile_owner(profile_id));
