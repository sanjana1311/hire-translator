-- Add target_roles to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_roles text DEFAULT NULL;

-- Add label to resumes for multi-resume support
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS label text DEFAULT 'General Resume';

-- Drop the unique constraint on resumes.profile_id to allow multiple resumes per profile
-- First find and drop the constraint
DO $$
BEGIN
  -- Drop the unique index if it exists
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'resumes_profile_id_key') THEN
    ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_profile_id_key;
  END IF;
END $$;

-- Add onboarded flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;