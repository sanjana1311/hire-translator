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

function looksLikeJobEmail(text: string): boolean {
  const lower = text.toLowerCase();
  return JOB_SIGNALS.some((s) => lower.includes(s));
}

function inferSource(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("glassdoor")) return "Glassdoor";
  if (lower.includes("ziprecruiter")) return "ZipRecruiter";
  return "Email Alert";
}

function extractJobUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return matches
    .filter((u) =>
      /(linkedin\.com\/jobs|\/jobs\/|\/job\/|\/careers\/|\/apply\/)/i.test(u)
    )
    .map((u) => u.replace(/[),.;]+$/, ""));
}

function extractFirstJobUrl(text: string): string | null {
  const jobUrls = extractJobUrls(text);
  if (jobUrls.length > 0) return jobUrls[0];
  const allUrls = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return allUrls.length > 0 ? allUrls[0].replace(/[),.;]+$/, "") : null;
}

function decodeBase64UrlToUtf8(base64Url: string): string {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeQuotedPrintable(input: string): string {
  const binary = input
    .replace(/=\r?\n/g, "")
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function collectMessageBodies(payload: any): { textPlain: string[]; textHtml: string[] } {
  const textPlain: string[] = [];
  const textHtml: string[] = [];

  const visit = (part: any) => {
    if (!part) return;

    const mimeType = String(part.mimeType || "").toLowerCase();
    const data = part.body?.data;

    if (typeof data === "string" && data.length > 0) {
      const decoded = decodeQuotedPrintable(decodeBase64UrlToUtf8(data));
      if (mimeType === "text/plain") textPlain.push(decoded);
      if (mimeType === "text/html") textHtml.push(decoded);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) visit(child);
    }
  };

  visit(payload);
  return { textPlain, textHtml };
}

function htmlToTextWithLineBreaks(raw: string): string {
  return raw
    .replace(/=\r?\n/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|table|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&middot;/gi, " · ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\u00c2/g, "")
    .replace(/Â/g, "")
    .replace(/â€["“”]/g, "-")
    .replace(/â€[˜™]/g, "'")
    .replace(/â€¦/g, "...")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanupJobTitle(subject: string): string {
  return subject
    .replace(/^fwd:\s*/i, "")
    .replace(/^fw:\s*/i, "")
    .replace(/\s*[|\-–]\s*LinkedIn.*$/i, "")
    .replace(/\bLinkedIn\b/gi, "")
    .replace(/\b(?:your\s+)?job\s+alert\b[:\-\s]*/gi, "")
    .replace(/\bnew\s+jobs?\s+for\s+you\b[:\-\s]*/gi, "")
    .replace(/\bjobs?\s+for\s+you\b[:\-\s]*/gi, "")
    .replace(/\bjob\s+recommendations?\b[:\-\s]*/gi, "")
    .replace(/\bhiring\s+alert\b[:\-\s]*/gi, "")
    .replace(/\s+and\s+more$/i, "")
    .replace(/[“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTextLine(line: string): string {
  return line
    .replace(/[•▪●►]/g, " · ")
    .replace(/\u00a0/g, " ")
    .replace(/\u00c2/g, "")
    .replace(/Â/g, "")
    .replace(/â€["“”]/g, "-")
    .replace(/â€[˜™]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeJobTitle(line: string): boolean {
  const l = cleanTextLine(line);
  if (!l || l.length < 4 || l.length > 140) return false;
  if (/https?:\/\//i.test(l)) return false;

  if (
    /^(your job alert|new jobs in|see all jobs|view all jobs|install linkedin|stay updated|unsubscribe|jobs at a glance|top applicants|promoted)/i.test(
      l
    )
  ) {
    return false;
  }

  if (/(connections?|company alumni|fast growing|early applicant)/i.test(l)) {
    return false;
  }

  const keywordMatch =
    /(manager|engineer|analyst|developer|designer|scientist|architect|specialist|director|coordinator|consultant|lead|intern|operations|product|program|project|data|security|cloud|research|marketing|sales|recruiter|account executive|administrator|technician|owner)/i.test(
      l
    );

  if (keywordMatch) return true;

  // Backup heuristic for title-like lines when keywords are absent
  return /^[A-Z][A-Za-z0-9&+\/'(),.\-–—\s]{3,140}$/.test(l) && l.split(" ").length >= 2;
}

function parseCompanyLocation(line: string): { company: string; location: string | null } | null {
  const l = cleanTextLine(line);
  if (!l || l.length < 3 || l.length > 160) return null;
  if (/https?:\/\//i.test(l)) return null;

  const parts = l
    .split(/\s(?:·|•|\||–|—|-)\s/)
    .map((p) => cleanTextLine(p))
    .filter(Boolean);

  if (parts.length >= 2) {
    const company = parts[0];
    const location = parts.slice(1).join(" · ") || null;

    if (
      company.length < 2 ||
      /^(linkedin|see all jobs|view all jobs|jobs at a glance|and more|a glance)$/i.test(company)
    ) {
      return null;
    }

    return { company, location };
  }

  return null;
}

function fallbackExtractJobsFromEmail(email: {
  subject: string;
  body: string;
  bodyText: string;
  snippet: string;
}): any[] {
  const { subject, bodyText, snippet } = email;
  const normalized = `${subject}\n${snippet}\n${bodyText}`;
  const source = inferSource(normalized);
  const allJobUrls = extractJobUrls(normalized);
  const fallbackUrl = extractFirstJobUrl(normalized);

  const jobs: any[] = [];
  const seen = new Set<string>();
  let urlIndex = 0;

  const pushJob = (titleRaw: string, companyRaw: string, locationRaw?: string | null) => {
    const title = cleanTextLine(titleRaw);
    const company = cleanTextLine(companyRaw);
    const location = locationRaw ? cleanTextLine(locationRaw) : null;

    const combined = `${title} ${company}`;
    if (!looksLikeJobTitle(title)) return;
    if (!company || company.length < 2) return;
    if (!/[A-Za-z]/.test(company) || !/[A-Z]/.test(company)) return;
    if (/^(email alert|linkedin|and more|a glance)$/i.test(company)) return;
    if (/(see all jobs|install linkedin|stay updated|unsubscribe|jobs at a glance|linkedin widgets|connections? you may know)/i.test(combined)) {
      return;
    }

    const key = `${title.toLowerCase()}__${company.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    jobs.push({
      title,
      company,
      location,
      salary: null,
      url: allJobUrls[urlIndex++] || fallbackUrl,
      source,
      snippet: snippet || null,
    });
  };

  // LinkedIn structure: title line followed by "Company · Location"
  const lines = bodyText
    .split("\n")
    .map(cleanTextLine)
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const titleLine = lines[i];
    const companyLoc = parseCompanyLocation(lines[i + 1]);
    if (!companyLoc) continue;
    pushJob(titleLine, companyLoc.company, companyLoc.location);
  }

  // Catch repeated "Title at Company" patterns (all matches, not first)
  const atPattern = /([A-Z][A-Za-z0-9&+\/'(),.\-–—\s]{2,100}?)\s+at\s+([A-Z][A-Za-z0-9&+\/'(),.\-\s]{2,80}?)(?:\s+(?:in|,|·)\s+([A-Za-z0-9,.\-\s]{2,80}))?(?=\s|$|\.)/gi;
  for (const m of normalized.matchAll(atPattern)) {
    pushJob(m[1], m[2], m[3] || null);
  }

  // Subject format: "keyword": Company - Role and more
  const linkedInSubjectMatch = subject.match(
    /[“"]?[^:"”]+[”"]?\s*:\s*([A-Z][A-Za-z0-9&+\/'(),.\-\s]{1,80})\s*-\s*([^|]+?)(?:\s+and\s+more)?$/i
  );
  if (linkedInSubjectMatch) {
    pushJob(linkedInSubjectMatch[2], linkedInSubjectMatch[1], null);
  }

  // Last-resort from subject
  if (jobs.length === 0) {
    const cleanedTitle = cleanupJobTitle(subject);
    if (cleanedTitle) {
      pushJob(cleanedTitle, source, null);
    }
  }

  return jobs.slice(0, 25);
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
  const emails: { subject: string; body: string; bodyText: string; snippet: string }[] = [];
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

    const snippet = (msg.snippet || "").replace(/\s+/g, " ").trim();

    const { textPlain, textHtml } = collectMessageBodies(msg.payload);

    let rawBody = "";
    if (textPlain.length > 0) {
      rawBody = textPlain.join("\n");
    } else if (textHtml.length > 0) {
      rawBody = textHtml.join("\n");
    } else if (msg.payload?.body?.data) {
      rawBody = decodeQuotedPrintable(
        decodeBase64UrlToUtf8(msg.payload.body.data)
      );
    }

    const bodyText = htmlToTextWithLineBreaks(rawBody);

    // Compact version for AI prompt
    const body = bodyText.replace(/\s+/g, " ").trim();

    emails.push({ subject, body, bodyText, snippet });
  }

  // Step 3 — Pre-filter: only emails with job signals
  const relevantEmails = emails.filter(({ subject, body, snippet }) =>
    looksLikeJobEmail(`${subject} ${snippet} ${body}`)
  );
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
  let aiUnavailable = false;

  for (const email of relevantEmails) {
    const { subject, body, snippet } = email;

    // Limit body to keep prompt manageable but allow enough for multi-job emails
    const truncatedBody = body.slice(0, 5000);

    const prompt = `You are parsing a job alert email. Extract every job listing mentioned. Return ONLY a valid JSON array, no other text, no markdown fences.

EMAIL SUBJECT: ${subject}
EMAIL SNIPPET: ${snippet}
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

    const pushFallbackJobs = () => {
      const fallbackJobs = fallbackExtractJobsFromEmail(email);
      if (fallbackJobs.length > 0) {
        for (const j of fallbackJobs) {
          j._sourceSubject = subject;
        }
        allExtractedJobs.push(...fallbackJobs);
      }
      console.log(
        `[Gmail Sync] Fallback extracted ${fallbackJobs.length} jobs from: ${subject.slice(0, 60)}`
      );
    };

    if (aiUnavailable) {
      pushFallbackJobs();
      continue;
    }

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
            model: "google/gemini-2.5-flash-lite",
            temperature: 0.0,
            max_tokens: 1200,
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );

      if (!aiRes.ok) {
        const status = aiRes.status;
        if (status === 429) {
          console.warn("Rate limited, pausing...");
          await new Promise((r) => setTimeout(r, 2000));
        } else if (status === 402) {
          aiUnavailable = true;
          console.warn("AI unavailable (402). Falling back to parser for all remaining emails.");
        } else {
          console.error("AI error:", status);
        }
        pushFallbackJobs();
        continue;
      }

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const finishReason = aiData.choices?.[0]?.finish_reason;
      console.log(
        `[Gmail Sync] AI response for "${subject.slice(0, 50)}": ${raw.length} chars, finish_reason: ${finishReason}`
      );

      let cleaned = raw.replace(/```json|```/g, "").trim();

      // Repair truncated JSON: if the response was cut off, try to close the array
      if (
        finishReason === "length" ||
        (!cleaned.endsWith("]") && cleaned.includes("{"))
      ) {
        console.warn(
          `[Gmail Sync] Truncated AI response for: ${subject.slice(0, 50)}, attempting repair`
        );
        const lastCompleteObj = cleaned.lastIndexOf("}");
        if (lastCompleteObj > 0) {
          cleaned = cleaned.slice(0, lastCompleteObj + 1);
          if (!cleaned.endsWith("]")) {
            cleaned += "]";
          }
          if (!cleaned.startsWith("[")) {
            cleaned = "[" + cleaned;
          }
        }
      }

      const jobs = JSON.parse(cleaned);
      if (Array.isArray(jobs) && jobs.length > 0) {
        for (const j of jobs) {
          j._sourceSubject = subject;
        }
        allExtractedJobs.push(...jobs);
        console.log(
          `[Gmail Sync] Extracted ${jobs.length} jobs from: ${subject.slice(0, 60)}`
        );
      } else {
        pushFallbackJobs();
      }
    } catch (e) {
      console.error("AI extraction error for email:", subject, e);
      pushFallbackJobs();
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
