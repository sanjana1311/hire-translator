import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { profileIdFor } from "../supabase";

export default defineTool({
  name: "update_application",
  title: "Update an application",
  description: "Update the status, next action, or notes of an existing hireOS application.",
  inputSchema: {
    application_id: z.string().describe("The application id to update."),
    status: z.string().optional().describe("New status, e.g. interview, offer, rejected."),
    next_action: z.string().optional().describe("New next action."),
    notes: z.string().optional().describe("New notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ application_id, status, next_action, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const updates: Record<string, string> = {};
    if (status !== undefined) updates.status = status;
    if (next_action !== undefined) updates.next_action = next_action;
    if (notes !== undefined) updates.notes = notes;
    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "Nothing to update" }], isError: true };
    }
    const { supabase, profileId } = await profileIdFor(ctx);
    const { data, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", application_id)
      .eq("profile_id", profileId)
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Application not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { application: data } };
  },
});
