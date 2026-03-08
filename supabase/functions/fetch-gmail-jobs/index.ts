import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/** Build Gmail search query using last sync timestamp (or fallback to 7 days) */
function buildGmailQuery(lastSyncedAt: string | null): string {
  const subjects = '(job alert OR new job OR job opportunity OR "jobs for you" OR "new jobs" OR "recommended jobs" OR "job match")';

  if (lastSyncedAt) {
    // Gmail after: uses epoch seconds
    const epoch = Math.floor(new Date(lastSyncedAt).getTime() / 1000);
    return `subject:${subjects} after:${epoch}`;
  }

  // First sync — look back 7 days as a reasonable default
  return `subject:${subjects} newer_than:7d`;
}

/** Core sync logic — works for both manual trigger and cron */
export async function syncGmailJobs(options: {
  accessToken: string;
  profileId: string;
  adminClient: any;
  lastSyncedAt: string | null;
}): Promise<{ jobs: any[]; emailCount: number }> {
  const { accessToken, profileId, adminClient, lastSyncedAt } = options;

  const query = encodeURIComponent(buildGmailQuery(lastSyncedAt));
  const gmailRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    console.error("Gmail API error:", gmailRes.status, errText);
    if (gmailRes.status === 401 || gmailRes.status === 403) {
      throw new Error("Gmail access denied. Please sign in again with Google.");
    }
    throw new Error(`Gmail API error: ${gmailRes.status}`);
  }

  const gmailData = await gmailRes.json();
  const messageIds = (gmailData.messages || []).map((m: any) => m.id);

  if (messageIds.length === 0) {
    // Update last_synced_at even if no new emails
    await adminClient
      .from("gmail_sync_metadata")
      .upsert({ profile_id: profileId, last_synced_at: new Date().toISOString() }, { onConflict: "profile_id" });
    return { jobs: [], emailCount: 0 };
  }

  // Fetch email details (batch up to 15)
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
      .upsert({ profile_id: profileId, last_synced_at: new Date().toISOString() }, { onConflict: "profile_id" });
    return { jobs: [], emailCount: 0 };
  }

  // Use AI to extract job listings
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.2,
      max_tokens: 4000,
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
                      title: { type: "string", description: "Job title" },
                      company: { type: "string", description: "Company name" },
                      location: { type: "string", description: "Job location or Remote" },
                      url: { type: "string", description: "Application URL if found, empty string otherwise" },
                      source: { type: "string", description: "Email source (LinkedIn, Indeed, Glassdoor, etc.)" },
                      snippet: { type: "string", description: "Brief description if available" },
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
      tool_choice: { type: "function", function: { name: "extract_jobs" } },
      messages: [
        {
          role: "system",
          content:
            "Extract individual job listings from these job alert emails. These are automated job alert/recommendation emails from platforms like LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter, etc. Extract every distinct job posting: title, company, location, application URL, which platform sent the email, and a brief snippet. Return unique jobs only. Skip vague entries without a clear title or company.",
        },
        {
          role: "user",
          content: `Extract jobs from these ${emailBodies.length} emails:\n\n${emailBodies.join("\n\n---EMAIL SEPARATOR---\n\n")}`,
        },
      ],
    }),
  });

  if (!aiRes.ok) {
    const status = aiRes.status;
    if (status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
    if (status === 402) throw new Error("AI credits exhausted.");
    throw new Error("AI extraction failed");
  }

  const aiData = await aiRes.json();
  let jobs: any[] = [];

  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      jobs = parsed.jobs || [];
    } catch {
      console.error("Failed to parse AI tool call response");
    }
  }

  // Deduplicate by title+company
  const seen = new Set<string>();
  jobs = jobs.filter((j: any) => {
    const key = `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Persist to imported_jobs (upsert to avoid duplicates)
  if (jobs.length > 0) {
    const rows = jobs.map((j: any) => ({
      profile_id: profileId,
      title: j.title,
      company: j.company,
      location: j.location || "",
      url: j.url || "",
      source: j.source || "",
      snippet: j.snippet || "",
    }));

    const { error: insertErr } = await adminClient
      .from("imported_jobs")
      .upsert(rows, { onConflict: "profile_id,title,company", ignoreDuplicates: true });

    if (insertErr) console.error("Error inserting imported jobs:", insertErr);
  }

  // Update last_synced_at
  await adminClient
    .from("gmail_sync_metadata")
    .upsert({ profile_id: profileId, last_synced_at: new Date().toISOString() }, { onConflict: "profile_id" });

  return { jobs, emailCount: emailBodies.length };
}

// ─── HTTP handler (manual trigger from frontend) ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { providerToken, refreshToken } = await req.json();
    if (!providerToken) throw new Error("No Google provider token. Please sign in with Google first.");

    // Store refresh token if provided
    if (refreshToken) {
      await adminClient
        .from("gmail_sync_metadata")
        .upsert(
          { profile_id: profile.id, refresh_token: refreshToken },
          { onConflict: "profile_id" }
        );
    }

    // Get last sync time
    const { data: syncMeta } = await adminClient
      .from("gmail_sync_metadata")
      .select("last_synced_at")
      .eq("profile_id", profile.id)
      .single();

    const result = await syncGmailJobs({
      accessToken: providerToken,
      profileId: profile.id,
      adminClient,
      lastSyncedAt: syncMeta?.last_synced_at || null,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("fetch-gmail-jobs error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
