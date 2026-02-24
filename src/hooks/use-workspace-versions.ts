import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceVersion {
  id: string;
  workspace_id: string;
  version_number: number;
  resume_snapshot: any;
  created_at: string;
}

export function useWorkspaceVersions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-versions", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_versions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkspaceVersion[];
    },
  });
}

export function useSaveVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      snapshot,
    }: {
      workspaceId: string;
      snapshot: any;
    }) => {
      // Get next version number
      const { data: existing } = await supabase
        .from("workspace_versions")
        .select("version_number")
        .eq("workspace_id", workspaceId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

      const { data, error } = await supabase
        .from("workspace_versions")
        .insert({
          workspace_id: workspaceId,
          version_number: nextVersion,
          resume_snapshot: snapshot,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkspaceVersion;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["workspace-versions", vars.workspaceId] }),
  });
}

export function useDeleteVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase
        .from("workspace_versions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return workspaceId;
    },
    onSuccess: (workspaceId) =>
      qc.invalidateQueries({ queryKey: ["workspace-versions", workspaceId] }),
  });
}
