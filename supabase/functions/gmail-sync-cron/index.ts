import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Refresh a Google access token using a stored refresh token */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Token refresh failed:", err);
    throw new Error("Failed to refresh Google token");
  }

  const data = await res.json();
  return data.access_token;
}

function buildGmailQuery(lastSyncedAt: string | null): string {
  const subjects = '(job alert OR new job OR job opportunity OR "jobs for you" OR "new jobs" OR "recommended jobs" OR "job match")';
  if (lastSyncedAt) {
    const epoch = Math.floor(new Date(lastSyncedAt).getTime() / 1000);
    return `subject:${subjects} after:${epoch}`;
  }
  return `subject:${subjects} newer_than:7d`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get all users who have enabled gmail sync with a refresh token
    const { data: syncUsers, error: fetchErr } = await adminClient
      .from("gmail_sync_metadata")
      .select("profile_id, last_synced_at, refresh_token")
      .eq("enabled", true)
      .not("refresh_token", "is", null);

    if (fetchErr) throw fetchErr;
    if (!syncUsers || syncUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No users to sync", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { profileId: string; jobCount: number; error?: string }[] = [];

    for (const syncUser of syncUsers) {
      try {
        // Refresh the access token
        const accessToken = await refreshAccessToken(syncUser.refresh_token);

        // Fetch and parse Gmail
        const query = encodeURIComponent(buildGmailQuery(syncUser.last_synced_at));
        const gmailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!gmailRes.ok) {
          const errText = await gmailRes.text();
          console.error(`Gmail error for ${syncUser.profile_id}:`, gmailRes.status, errText);
          
          // If token is revoked, disable sync for this user
          if (gmailRes.status === 401 || gmailRes.status === 403) {
            await adminClient
              .from("gmail_sync_metadata")
              .update({ enabled: false })
              .eq("profile_id", syncUser.profile_id);
            results.push({ profileId: syncUser.profile_id, jobCount: 0, error: "Token revoked, sync disabled" });
          } else {
            results.push({ profileId: syncUser.profile_id, jobCount: 0, error: `Gmail API ${gmailRes.status}` });
          }
          continue;
        }

        const gmailData = await gmailRes.json();
        const messageIds = (gmailData.messages || []).map((m: any) => m.id);

        if (messageIds.length === 0) {
          await adminClient
            .from("gmail_sync_metadata")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("profile_id", syncUser.profile_id);
          results.push({ profileId: syncUser.profile_id, jobCount: 0 });
          continue;
        }

        // Fetch email bodies
        const emailBodies: string[] = [];
        for (const msgId of messageIds.slice(0, 15)) {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!msgRes.ok) continue;
          const msg = await msgRes.json();
          const subject = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
          const from = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
          let body = "";
          if (msg.payload?.body?.data) {
            body = atob(msg.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          } else if (msg.payload?.parts) {
            const textPart = msg.payload.parts.find((p: any) => p.mimeType === "text/plain");
            if (textPart?.body?.data) {
              body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            }
          }
          emailBodies.push(`FROM: ${from}\nSUBJECT: ${subject}\n\n${body.slice(0, 3000)}`);
        }

        if (emailBodies.length === 0) {
          await adminClient
            .from("gmail_sync_metadata")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("profile_id", syncUser.profile_id);
          results.push({ profileId: syncUser.profile_id, jobCount: 0 });
          continue;
        }

        // AI extraction
        const aiRes = await callAI({
          temperature: 0.2,
          maxTokens: 4000,
          tools: [
            {
              type: "function",
              function: {
                name: "extract_jobs",
                description: "Extract job listings from email content",
                parameters: {
                  type: "object",
                  properties: {
                    jobs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          company: { type: "string" },
                          location: { type: "string" },
                          url: { type: "string" },
                          source: { type: "string" },
                          snippet: { type: "string" },
                        },
                        required: ["title", "company", "location", "url", "source", "snippet"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["jobs"],
                  additionalProperties: false,
                },
              },
            },
          ],
          toolChoice: { type: "function", function: { name: "extract_jobs" } },
          messages: [
            {
              role: "system",
              content: "Extract individual job listings from these job alert emails. Return unique jobs only.",
            },
            {
              role: "user",
              content: `Extract jobs from these ${emailBodies.length} emails:\n\n${emailBodies.join("\n\n---EMAIL SEPARATOR---\n\n")}`,
            },
          ],
        });

        let jobs: any[] = [];
        const toolCall = aiRes.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try {
            jobs = JSON.parse(toolCall.function.arguments).jobs || [];
          } catch (error) {
            console.warn("Scheduled job extraction returned invalid tool arguments", error);
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        jobs = jobs.filter((j: any) => {
          const key = `${j.title}|${j.company}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Persist
        if (jobs.length > 0) {
          const rows = jobs.map((j: any) => ({
            profile_id: syncUser.profile_id,
            title: j.title,
            company: j.company,
            location: j.location || "",
            url: j.url || "",
            source: j.source || "",
            snippet: j.snippet || "",
          }));
          await adminClient
            .from("imported_jobs")
            .upsert(rows, { onConflict: "profile_id,title,company", ignoreDuplicates: true });
        }

        // Update sync timestamp
        await adminClient
          .from("gmail_sync_metadata")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("profile_id", syncUser.profile_id);

        results.push({ profileId: syncUser.profile_id, jobCount: jobs.length });
      } catch (userErr: any) {
        console.error(`Sync failed for ${syncUser.profile_id}:`, userErr.message);
        results.push({ profileId: syncUser.profile_id, jobCount: 0, error: userErr.message });
      }
    }

    return new Response(JSON.stringify({ synced: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("gmail-sync-cron error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
