import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "get_job",
  title: "Get job details",
  description: "Get full details for one imported hireOS job, including description and AI match analysis.",
  inputSchema: { job_id: z.string().describe("The imported job id.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ job_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    const { data, error } = await supabase
      .from("imported_jobs")
      .select("id,title,company,location,salary,url,source,status,snippet,description,analysis,imported_at")
      .eq("profile_id", profileId)
      .eq("id", job_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Job not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { job: data } };
  },
});
