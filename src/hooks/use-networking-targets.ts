import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-profile";

export type ConnectionType =
  | "hiring_manager"
  | "recruiter"
  | "team_member"
  | "alumni"
  | "former_colleague"
  | "industry_connection";

export type TargetStatus = "not_contacted" | "contacted" | "replied" | "follow_up_due" | "not_a_fit";

export interface NetworkingTarget {
  id: string;
  profile_id: string;
  imported_job_id: string | null;
  job_title: string;
  company: string;
  location: string | null;
  name: string;
  headline: string;
  target_company: string;
  connection_type: ConnectionType | string;
  match_reason: string;
  evidence: string | null;
  linkedin_url: string | null;
  search_url: string | null;
  relevance: number;
  outreach_message: string | null;
  source: string;
  status: TargetStatus | string;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export const CONNECTION_TYPE_LABEL: Record<string, string> = {
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  team_member: "Team member",
  alumni: "Alumni",
  former_colleague: "Former colleague",
  industry_connection: "Industry connection",
};

export const STATUS_LABEL: Record<string, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  replied: "Replied",
  follow_up_due: "Follow-up due",
  not_a_fit: "Not a fit",
};

export function useNetworkingTargets(jobId: string | undefined) {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["networking-targets", profile?.id, jobId],
    enabled: !!profile?.id && !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networking_targets")
        .select("*")
        .eq("profile_id", profile!.id)
        .eq("imported_job_id", jobId!)
        .order("relevance", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NetworkingTarget[];
    },
  });
}

export function useSaveNetworkingTargets() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async (rows: Partial<NetworkingTarget>[]) => {
      if (!profile?.id) throw new Error("No profile");
      const { data, error } = await supabase
        .from("networking_targets")
        .insert(rows.map(r => ({ ...r, profile_id: profile.id })) as never)
        .select();
      if (error) throw error;
      return data as NetworkingTarget[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["networking-targets"] }),
  });
}

export function useUpdateNetworkingTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NetworkingTarget> & { id: string }) => {
      const { error } = await supabase.from("networking_targets").update(updates as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["networking-targets"] }),
  });
}

export function useDeleteNetworkingTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("networking_targets").delete().eq("imported_job_id", jobId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["networking-targets"] }),
  });
}

export function linkedInSearchUrl(parts: (string | null | undefined)[]) {
  const keywords = parts.filter(Boolean).join(" ").trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
