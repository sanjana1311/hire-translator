import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "list_workspaces",
  title: "List job workspaces",
  description: "List hireOS job workspaces (tailored resume workspaces) with ATS score and match bucket.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max workspaces to return (default 20)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    const { data, error } = await supabase
      .from("job_workspaces")
      .select("id,role_title,company,status,ats_score,baseline_score,score_delta,match_bucket,updated_at")
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { workspaces: data ?? [] },
    };
  },
});
