import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-profile";

export interface ResumeData {
  id: string;
  profile_id: string;
  summary: string;
  experience: any[];
  projects: any[];
  education: any[];
  skills: any[];
  achievements: any[];
  raw_text: string;
  created_at: string;
  updated_at: string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  file_uploaded_at?: string | null;
}

export function useResume() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["resume", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("profile_id", profile!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = (data as unknown as ResumeData[]) ?? [];
      if (rows.length === 0) return null;
      // Merge: the newest row is the base, but pull file metadata / raw text
      // from whichever row actually has them (legacy accounts can have 2 rows).
      const base = { ...rows[0] };
      const withFile = rows.find((r) => r.file_path);
      if (withFile && !base.file_path) {
        base.file_path = withFile.file_path;
        base.file_name = withFile.file_name;
        base.file_size = withFile.file_size;
        base.file_type = withFile.file_type;
        base.file_uploaded_at = withFile.file_uploaded_at;
      }
      if (!base.raw_text || base.raw_text.length < 100) {
        const withText = rows.find((r) => (r.raw_text?.length ?? 0) > 100);
        if (withText) base.raw_text = withText.raw_text;
      }
      return base;
    },

  });
}

export function useUpsertResume() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async (resume: Partial<Omit<ResumeData, "id" | "profile_id" | "created_at" | "updated_at">>) => {
      if (!profile?.id) throw new Error("No profile");
      // Check if resume exists
      const { data: existing } = await supabase
        .from("resumes")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("resumes")
          .update(resume)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("resumes")
          .insert({ ...resume, profile_id: profile.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume"] }),
  });
}
