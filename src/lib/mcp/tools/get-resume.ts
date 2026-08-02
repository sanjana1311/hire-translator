import { defineTool } from "@lovable.dev/mcp-js";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "get_resume",
  title: "Get base resume",
  description: "Get the signed-in user's base hireOS resume: summary, experience, projects, education, skills.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    const { data, error } = await supabase
      .from("resumes")
      .select("id,label,summary,experience,projects,education,skills,achievements,updated_at")
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No resume saved yet" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { resume: data } };
  },
});
