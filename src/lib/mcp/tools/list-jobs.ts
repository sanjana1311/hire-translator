import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "list_jobs",
  title: "List imported jobs",
  description: "List job opportunities imported into hireOS for the signed-in user, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max jobs to return (default 20)."),
    status: z.string().optional().describe("Optional status filter, e.g. new, saved, applied."),
    search: z.string().optional().describe("Optional text to match against job title or company."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit, status, search }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    let query = supabase
      .from("imported_jobs")
      .select("id,title,company,location,salary,source,url,status,imported_at")
      .eq("profile_id", profileId)
      .order("imported_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});
