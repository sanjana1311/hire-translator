import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "create_application",
  title: "Track a new application",
  description: "Add a job application to the signed-in user's hireOS application tracker.",
  inputSchema: {
    title: z.string().describe("Role title."),
    company: z.string().describe("Company name."),
    status: z.string().optional().describe("Status, e.g. applied, interview. Defaults to applied."),
    applied_date: z.string().optional().describe("ISO date (YYYY-MM-DD) the application was submitted."),
    next_action: z.string().optional().describe("Next step to take."),
    notes: z.string().optional().describe("Freeform notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { supabase, profileId } = await profileIdFor(ctx);
    const { data, error } = await supabase
      .from("applications")
      .insert({
        profile_id: profileId,
        title: input.title,
        company: input.company,
        status: input.status ?? "applied",
        applied_date: input.applied_date ?? new Date().toISOString().slice(0, 10),
        next_action: input.next_action ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { application: data } };
  },
});
