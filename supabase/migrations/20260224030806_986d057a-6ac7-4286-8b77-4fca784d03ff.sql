
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Resumes table (one per user, structured JSON)
CREATE TABLE public.resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary TEXT DEFAULT '',
  experience JSONB DEFAULT '[]'::jsonb,
  projects JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  achievements JSONB DEFAULT '[]'::jsonb,
  raw_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Job workspaces table
CREATE TABLE public.job_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'applied')),
  job_description TEXT DEFAULT '',
  jd_analysis JSONB DEFAULT '{}'::jsonb,
  rewritten_bullets JSONB DEFAULT '[]'::jsonb,
  suggested_projects JSONB DEFAULT '[]'::jsonb,
  selected_projects JSONB DEFAULT '[]'::jsonb,
  ats_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace versions table
CREATE TABLE public.workspace_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.job_workspaces(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  resume_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, version_number)
);
ALTER TABLE public.workspace_versions ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_profile_owner(p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_workspaces jw
    JOIN public.profiles p ON p.id = jw.profile_id
    WHERE jw.id = p_workspace_id AND p.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_workspaces_updated_at BEFORE UPDATE ON public.job_workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: resumes
CREATE POLICY "Users can view own resume" ON public.resumes FOR SELECT USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can insert own resume" ON public.resumes FOR INSERT WITH CHECK (public.is_profile_owner(profile_id));
CREATE POLICY "Users can update own resume" ON public.resumes FOR UPDATE USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can delete own resume" ON public.resumes FOR DELETE USING (public.is_profile_owner(profile_id));

-- RLS Policies: job_workspaces
CREATE POLICY "Users can view own workspaces" ON public.job_workspaces FOR SELECT USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can insert own workspaces" ON public.job_workspaces FOR INSERT WITH CHECK (public.is_profile_owner(profile_id));
CREATE POLICY "Users can update own workspaces" ON public.job_workspaces FOR UPDATE USING (public.is_profile_owner(profile_id));
CREATE POLICY "Users can delete own workspaces" ON public.job_workspaces FOR DELETE USING (public.is_profile_owner(profile_id));

-- RLS Policies: workspace_versions
CREATE POLICY "Users can view own versions" ON public.workspace_versions FOR SELECT USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "Users can insert own versions" ON public.workspace_versions FOR INSERT WITH CHECK (public.is_workspace_owner(workspace_id));
CREATE POLICY "Users can update own versions" ON public.workspace_versions FOR UPDATE USING (public.is_workspace_owner(workspace_id));
CREATE POLICY "Users can delete own versions" ON public.workspace_versions FOR DELETE USING (public.is_workspace_owner(workspace_id));
