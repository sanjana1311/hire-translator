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
        .maybeSingle();
      if (error) throw error;
      return data as ResumeData | null;
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
