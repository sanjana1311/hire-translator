import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-profile";

export interface Workspace {
  id: string;
  profile_id: string;
  company: string;
  role_title: string;
  status: string;
  job_description: string;
  jd_analysis: any;
  rewritten_bullets: any[];
  suggested_projects: any[];
  selected_projects: any[];
  ats_score: number;
  baseline_score: number;
  score_delta: number;
  gap_analysis: any;
  created_at: string;
  updated_at: string;
}

export function useWorkspaces() {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["workspaces", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_workspaces")
        .select("*")
        .eq("profile_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
  });
}

export function useWorkspace(id: string | undefined) {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["workspace", id],
    enabled: !!id && !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_workspaces")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Workspace;
    },
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async (ws: { job_description: string }) => {
      if (!profile?.id) throw new Error("No profile");
      const { data, error } = await supabase
        .from("job_workspaces")
        .insert({ ...ws, profile_id: profile.id })
        .select()
        .single();
      if (error) throw error;
      return data as Workspace;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Workspace> & { id: string }) => {
      const { data, error } = await supabase
        .from("job_workspaces")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["workspace", vars.id] });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_workspaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}
