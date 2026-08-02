import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "list_applications",
  title: "List applications",
  description: "List the signed-in user's job applications tracked in hireOS with status and next action.",
  inputSchema: {
    status: z.string().optional().describe("Optional status filter, e.g. applied, interview, rejected."),
    limit: z.number().int().min(1).max(50).optional().describe("Max applications to return (default 25)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    let query = supabase
      .from("applications")
      .select("id,title,company,status,applied_date,next_action,last_email_date,notes")
      .eq("profile_id", profileId)
      .order("applied_date", { ascending: false })
      .limit(limit ?? 25);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { applications: data ?? [] },
    };
  },
});
