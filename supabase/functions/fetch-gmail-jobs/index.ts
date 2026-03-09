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
    console.error("Token refresh failed:", res.status, err);
    console.error("Using client_id:", clientId?.slice(0, 20) + "...");
    throw new Error(`Failed to refresh Google token: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Build Gmail search query using last sync timestamp */
function buildGmailQuery(lastSyncedAt: string | null): string {
  const daysSinceSync = lastSyncedAt
    ? Math.max(1, Math.ceil((Date.now() - new Date(lastSyncedAt).getTime()) / 86400000))
    : 30;

  console.log("[Gmail Sync] Days since last sync:", daysSinceSync);

  return `(from:jobalerts-noreply@linkedin.com OR "job alert" OR "new jobs" OR "new job" OR "jobs for you" OR "job for you" OR "new openings" OR "jobs matching" OR "roles for you" OR "hiring alert" OR "job recommendations" OR "job recommendation" OR "your job alert") newer_than:${daysSinceSync}d`;
}

/** Pre-filter: only emails that look like real job listings */
const JOB_SIGNALS = [
  "apply",
  "view job",
  "see job",
  "open position",
  "job opening",
  "we're hiring",
  "we are hiring",
  "new role",
  "/jobs/",
  "/job/",
  "/careers/",
  "/apply/",
  "job alert",
  "new opening",
];

function looksLikeJobEmail(body: string): boolean {
  const lower = body.toLowerCase();
  return JOB_SIGNALS.some((s) => lower.includes(s));
}

/** Fetch full job description from a URL */
async function fetchJobDescription(
  url: string
): Promise<{ description: string | null; urlVerified: boolean }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; career-compass-bot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { description: null, urlVerified: false };

    const html = await res.text();
    let description: string | null = null;

    // Try JSON-LD first — LinkedIn and many job boards use this
    const jsonLdMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i
    );
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        description =
          jsonLd.description || jsonLd.responsibilities || null;
        if (description) {
          description = description
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      } catch {
        /* JSON-LD parse failed */
      }
    }

    // Fallback — common job description HTML patterns
    if (!description) {
      const patterns = [
        /class="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*jobsearch-jobDescriptionText[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /id="[^"]*job-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          description = match[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000);
          break;
        }
      }
    }

    return { description, urlVerified: true };
  } catch {
    return { description: null, urlVerified: false };
  }
}

/** Core sync logic */
export async function syncGmailJobs(options: {
  accessToken: string;
  profileId: string;
  adminClient: any;
  lastSyncedAt: string | null;
}): Promise<{ jobs: any[]; emailCount: number }> {
  const { accessToken, profileId, adminClient, lastSyncedAt } = options;

  // Step 1 — Search Gmail
  const rawQuery = buildGmailQuery(lastSyncedAt);
  console.log("[Gmail Sync] Search query:", rawQuery);
  console.log("[Gmail Sync] lastSyncedAt:", lastSyncedAt);
  
  const query = encodeURIComponent(rawQuery);
  const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;
  console.log("[Gmail Sync] Gmail API URL:", gmailUrl);
  
  const gmailRes = await fetch(gmailUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    console.error("Gmail API error:", gmailRes.status, errText);
    if (gmailRes.status === 401 || gmailRes.status === 403) {
      throw new Error("Gmail access denied. Please sign in again with Google.");
    }
    throw new Error(`Gmail API error: ${gmailRes.status}`);
  }

  const gmailData = await gmailRes.json();
  console.log("[Gmail Sync] Raw Gmail API response:", JSON.stringify(gmailData).slice(0, 500));
  console.log("[Gmail Sync] resultSizeEstimate:", gmailData.resultSizeEstimate);

  if (!gmailData.messages?.length) {
    console.log("[Gmail Sync] Zero messages returned. resultSizeEstimate:", gmailData.resultSizeEstimate);
    await adminClient
      .from("gmail_sync_metadata")
      .upsert(
        { profile_id: profileId, last_synced_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      );
    return { jobs: [], emailCount: 0, query: rawQuery, resultSizeEstimate: gmailData.resultSizeEstimate };
  }

  const messageIds = gmailData.messages.map((m: any) => m.id);
  console.log("[Gmail Sync] Messages found:", messageIds.length);

  // Step 2 — Fetch each email body
  const emails: { subject: string; body: string }[] = [];
  for (const msgId of messageIds) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();

    const subject =
      msg.payload?.headers?.find(
        (h: any) => h.name.toLowerCase() === "subject"
      )?.value || "";

    let rawBody = "";
    if (msg.payload?.body?.data) {
      rawBody = atob(
        msg.payload.body.data.replace(/-/g, "+").replace(/_/g, "/")
      );
    } else if (msg.payload?.parts) {
      const textPart =
        msg.payload.parts.find((p: any) => p.mimeType === "text/plain") ||
        msg.payload.parts.find((p: any) => p.mimeType === "text/html");
      if (textPart?.body?.data) {
        rawBody = atob(
          textPart.body.data.replace(/-/g, "+").replace(/_/g, "/")
        );
      }
    }

    // Strip HTML tags for cleaner AI input
    const body = rawBody
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    emails.push({ subject, body });
  }

  // Step 3 — Pre-filter: only emails with job signals
  const relevantEmails = emails.filter(({ body }) => looksLikeJobEmail(body));
  console.log(
    `Emails fetched: ${emails.length}, relevant after filter: ${relevantEmails.length}`
  );

  if (relevantEmails.length === 0) {
    await adminClient
      .from("gmail_sync_metadata")
      .upsert(
        { profile_id: profileId, last_synced_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      );
    return { jobs: [], emailCount: emails.length };
  }

  // Step 4 — AI extraction (one call per email)
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const allExtractedJobs: any[] = [];

  for (const { subject, body } of relevantEmails) {
    // Limit body to keep prompt manageable but allow enough for multi-job emails
    const truncatedBody = body.slice(0, 8000);

    const prompt = `You are parsing a job alert email. Extract every job listing mentioned. Return ONLY a valid JSON array, no other text, no markdown fences.

EMAIL SUBJECT: ${subject}
EMAIL BODY:
${truncatedBody}

For each job found return:
[{
  "title": "exact job title as written",
  "company": "company name",
  "location": "city, state or Remote",
  "salary": "salary range if mentioned, else null",
  "url": "direct URL to the job posting if present, else null",
  "source": "email platform (LinkedIn, Indeed, Glassdoor, Monster, etc.)",
  "snippet": "brief one-line description if available, else null"
}]

Rules:
- Only extract real job openings explicitly listed in this email
- Skip anything that is not a specific open role
- If a job has no URL still include it with url set to null
- Return [] if no real job listings are found
- Never invent or guess any field
- Keep snippet SHORT (under 100 chars) to avoid long output
- Return raw JSON array only`;

    try {
      const aiRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.0,
            max_tokens: 8000,
            messages: [
              { role: "user", content: prompt },
            ],
          }),
        }
      );

      if (!aiRes.ok) {
        const status = aiRes.status;
        if (status === 429) {
          console.warn("Rate limited, pausing...");
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        console.error("AI error:", status);
        continue;
      }

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const finishReason = aiData.choices?.[0]?.finish_reason;
      console.log(`[Gmail Sync] AI response for "${subject.slice(0, 50)}": ${raw.length} chars, finish_reason: ${finishReason}`);
      
      let cleaned = raw.replace(/```json|```/g, "").trim();

      // Repair truncated JSON: if the response was cut off, try to close the array
      if (finishReason === "length" || (!cleaned.endsWith("]") && cleaned.includes("{"))) {
        console.warn(`[Gmail Sync] Truncated AI response for: ${subject.slice(0, 50)}, attempting repair`);
        // Find the last complete object by finding last "},"  or "}"
        const lastCompleteObj = cleaned.lastIndexOf("}");
        if (lastCompleteObj > 0) {
          cleaned = cleaned.slice(0, lastCompleteObj + 1);
          // Ensure it ends with ]
          if (!cleaned.endsWith("]")) {
            cleaned += "]";
          }
          // Ensure it starts with [
          if (!cleaned.startsWith("[")) {
            cleaned = "[" + cleaned;
          }
        }
      }

      const jobs = JSON.parse(cleaned);
      if (Array.isArray(jobs)) {
        for (const j of jobs) {
          j._sourceSubject = subject;
        }
        allExtractedJobs.push(...jobs);
        console.log(`[Gmail Sync] Extracted ${jobs.length} jobs from: ${subject.slice(0, 60)}`);
      }
    } catch (e) {
      console.error("AI extraction error for email:", subject, e);
      continue;
    }

    // Stagger calls 300ms apart
    await new Promise((r) => setTimeout(r, 300));
  }

  // Step 5 — Deduplicate against existing DB rows (last 60 days)
  const normalize = (str: string) =>
    str?.toLowerCase().trim().replace(/\s+/g, " ") || "";

  const { data: existingJobs } = await adminClient
    .from("imported_jobs")
    .select("title, company")
    .eq("profile_id", profileId)
    .gte(
      "imported_at",
      new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    );

  const existingSet = new Set(
    existingJobs?.map(
      (j: any) => `${normalize(j.title)}__${normalize(j.company)}`
    ) || []
  );

  // Also deduplicate within the batch
  const seenInBatch = new Set<string>();
  const newJobs = allExtractedJobs.filter((j) => {
    if (!j.title || !j.company) return false;
    const key = `${normalize(j.title)}__${normalize(j.company)}`;
    if (existingSet.has(key) || seenInBatch.has(key)) return false;
    seenInBatch.add(key);
    return true;
  });

  console.log(
    `Extracted: ${allExtractedJobs.length}, new after dedup: ${newJobs.length}`
  );

  // Step 6 — Fetch full job descriptions for jobs with URLs
  for (const job of newJobs) {
    if (job.url) {
      const { description, urlVerified } = await fetchJobDescription(job.url);
      job._description = description;
      job._urlVerified = urlVerified;
      job._descriptionFetchedAt = new Date().toISOString();
      // 500ms stagger between description fetches
      await new Promise((r) => setTimeout(r, 500));
    } else {
      job._description = null;
      job._urlVerified = false;
      job._descriptionFetchedAt = null;
    }
  }

  // Step 7 — Insert into Supabase
  if (newJobs.length > 0) {
    const rows = newJobs.map((j: any) => ({
      profile_id: profileId,
      title: j.title,
      company: j.company,
      location: j.location || "",
      salary: j.salary || null,
      url: j.url || "",
      url_verified: j._urlVerified || false,
      description: j._description || null,
      description_fetched_at: j._descriptionFetchedAt || null,
      source: j.source || "",
      snippet: j.snippet || "",
      source_email_subject: j._sourceSubject || null,
      status: "new",
    }));

    const { error: insertErr } = await adminClient
      .from("imported_jobs")
      .upsert(rows, {
        onConflict: "profile_id,title,company",
        ignoreDuplicates: true,
      });

    if (insertErr) console.error("Error inserting imported jobs:", insertErr);
  }

  // Update last_synced_at
  await adminClient
    .from("gmail_sync_metadata")
    .upsert(
      { profile_id: profileId, last_synced_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );

  return { jobs: newJobs, emailCount: relevantEmails.length };
}

// ─── HTTP handler (manual trigger from frontend) ───
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Get profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { providerToken, refreshToken, useRefreshToken } = await req.json();
    
    console.log("[Gmail Sync] providerToken:", providerToken ? "present" : "missing");
    console.log("[Gmail Sync] refreshToken:", refreshToken ? `present (${refreshToken.slice(0, 10)}...)` : "missing");
    console.log("[Gmail Sync] useRefreshToken flag:", useRefreshToken);
    
    let accessToken = providerToken;

    // If no provider token but we have a refresh token, use it to get a fresh access token
    if (!accessToken && useRefreshToken && refreshToken) {
      console.log("No provider token — refreshing via stored refresh token");
      accessToken = await refreshAccessToken(refreshToken);
      console.log("[Gmail Sync] Successfully refreshed access token");
    } else if (!accessToken) {
      // Try to get stored refresh token from DB
      const { data: storedMeta } = await adminClient
        .from("gmail_sync_metadata")
        .select("refresh_token")
        .eq("profile_id", profile.id)
        .single();

      if (storedMeta?.refresh_token) {
        console.log("[Gmail Sync] Using stored refresh token from DB:", storedMeta.refresh_token.slice(0, 10) + "...");
        accessToken = await refreshAccessToken(storedMeta.refresh_token);
      } else {
        throw new Error("No Google provider token. Please sign in with Google first.");
      }
    }

    // Store refresh token if provided
    if (refreshToken) {
      console.log("[Gmail Sync] Saving refresh token to DB for profile:", profile.id);
      await adminClient
        .from("gmail_sync_metadata")
        .upsert(
          { profile_id: profile.id, refresh_token: refreshToken },
          { onConflict: "profile_id" }
        );
      console.log("[Gmail Sync] Refresh token saved successfully");
    }

    // Get last sync time
    const { data: syncMeta } = await adminClient
      .from("gmail_sync_metadata")
      .select("last_synced_at")
      .eq("profile_id", profile.id)
      .single();

    const result = await syncGmailJobs({
      accessToken,
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
