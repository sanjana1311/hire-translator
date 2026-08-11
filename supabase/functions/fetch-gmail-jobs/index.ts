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
    if (err.includes("invalid_grant") || err.includes("Token has been expired or revoked")) {
      throw new Error("GOOGLE_TOKEN_EXPIRED");
    }
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

  // Known job-alert senders across the major ATS / job board platforms
  const senders = [
    "from:jobalerts-noreply@linkedin.com",
    "from:linkedin.com",
    "from:indeed.com",
    "from:indeedemail.com",
    "from:greenhouse.io",
    "from:greenhouse-mail.io",
    "from:lever.co",
    "from:hire.lever.co",
    "from:myworkday.com",
    "from:myworkdayjobs.com",
    "from:workday.com",
    "from:ziprecruiter.com",
    "from:glassdoor.com",
    "from:smartrecruiters.com",
    "from:ashbyhq.com",
    "from:workable.com",
    "from:jobvite.com",
    "from:icims.com",
  ].join(" OR ");

  const phrases = [
    '"job alert"',
    '"new jobs"',
    '"new job"',
    '"jobs for you"',
    '"job for you"',
    '"new openings"',
    '"jobs matching"',
    '"roles for you"',
    '"hiring alert"',
    '"job recommendations"',
    '"job recommendation"',
    '"your job alert"',
    '"we are hiring"',
    '"now hiring"',
    '"open position"',
    '"open roles"',
    '"careers at"',
    '"apply now"',
    '"view job"',
    '"job opportunity"',
  ].join(" OR ");

  return `(${senders} OR ${phrases}) newer_than:${daysSinceSync}d`;
}

/** Pre-filter: only emails that look like real job listings */
const JOB_SIGNALS = [
  "apply",
  "view job",
  "see job",
  "open position",
  "open role",
  "job opening",
  "we're hiring",
  "we are hiring",
  "now hiring",
  "new role",
  "/jobs/",
  "/job/",
  "/careers/",
  "/career/",
  "/apply/",
  "job alert",
  "new opening",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs",
  "smartrecruiters",
  "ashbyhq",
  "workable.com",
  "jobvite",
  "icims",
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
  if (lower.includes("greenhouse")) return "Greenhouse";
  if (lower.includes("lever.co")) return "Lever";
  if (lower.includes("myworkdayjobs") || lower.includes("workday")) return "Workday";
  if (lower.includes("smartrecruiters")) return "SmartRecruiters";
  if (lower.includes("ashbyhq")) return "Ashby";
  if (lower.includes("workable")) return "Workable";
  if (lower.includes("jobvite")) return "Jobvite";
  if (lower.includes("icims")) return "iCIMS";
  if (/\/careers?\//i.test(text)) return "Company Careers";
  return "Email Alert";
}

const JOB_URL_PATTERN =
  /(linkedin\.com\/jobs|indeed\.com\/(?:viewjob|rc\/clk|job)|boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com|smartrecruiters\.com|jobs\.ashbyhq\.com|apply\.workable\.com|jobvite\.com|icims\.com|\/jobs?\/|\/careers?\/|\/apply\/)/i;

function extractJobUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return matches
    .filter((u) => JOB_URL_PATTERN.test(u))
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

function decodeQuotedPrintableRaw(input: string): Uint8Array {
  // Decode QP to raw bytes WITHOUT interpreting as text
  const cleaned = input.replace(/=\r?\n/g, "");
  const parts: number[] = [];
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length && /[A-Fa-f0-9]{2}/.test(cleaned.slice(i + 1, i + 3))) {
      parts.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      parts.push(cleaned.charCodeAt(i));
      i++;
    }
  }
  return new Uint8Array(parts);
}

function decodeQuotedPrintable(input: string): string {
  const bytes = decodeQuotedPrintableRaw(input);
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
      // Base64url data is already binary — decode to UTF-8 directly
      const decoded = decodeBase64UrlToUtf8(data);
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

export interface EmailReport {
  subject: string;
  from: string;
  source: string;
  status: "imported" | "duplicate" | "no_jobs" | "rejected" | "parse_failed";
  reason: string | null;
  method: "ai" | "fallback" | "none";
  jobsFound: number;
  jobsImported: number;
  duplicates: number;
}

export interface SyncReport {
  emailsScanned: number;
  jobAlertsDetected: number;
  jobsImported: number;
  duplicatesSkipped: number;
  emailsRejected: number;
  parseFailures: number;
  applicationsMatched: number;
  query: string;
  emails: EmailReport[];
}

function logReport(report: SyncReport) {
  console.log(
    `[Gmail Sync][SUMMARY] scanned=${report.emailsScanned} jobAlerts=${report.jobAlertsDetected} imported=${report.jobsImported} duplicates=${report.duplicatesSkipped} rejected=${report.emailsRejected} parseFailures=${report.parseFailures} applicationsMatched=${report.applicationsMatched}`
  );
  for (const e of report.emails) {
    console.log(
      `[Gmail Sync][EMAIL] status=${e.status} method=${e.method} found=${e.jobsFound} imported=${e.jobsImported} dupes=${e.duplicates} source=${e.source} reason=${e.reason ?? "-"} subject="${e.subject.slice(0, 80)}"`
    );
  }
}

/**
 * Re-run application status matching from imported job records.
 * Links applications to imported_jobs by normalized title + company.
 */
async function rematchApplications(adminClient: any, profileId: string): Promise<number> {
  const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

  const { data: apps } = await adminClient
    .from("applications")
    .select("id, title, company, imported_job_id")
    .eq("profile_id", profileId);

  const { data: imported } = await adminClient
    .from("imported_jobs")
    .select("id, title, company")
    .eq("profile_id", profileId);

  if (!apps?.length || !imported?.length) return 0;

  const byKey = new Map<string, string>();
  for (const j of imported) byKey.set(`${norm(j.title)}__${norm(j.company)}`, j.id);
  const byCompany = new Map<string, string>();
  for (const j of imported) if (!byCompany.has(norm(j.company))) byCompany.set(norm(j.company), j.id);

  let matched = 0;
  for (const app of apps) {
    if (app.imported_job_id) continue;
    const exact = byKey.get(`${norm(app.title)}__${norm(app.company)}`);
    const fallback = exact || byCompany.get(norm(app.company));
    if (!fallback) continue;
    const { error } = await adminClient
      .from("applications")
      .update({ imported_job_id: fallback })
      .eq("id", app.id);
    if (!error) matched++;
  }

  console.log(`[Gmail Sync] Applications re-matched to imported jobs: ${matched}`);
  return matched;
}

/** Core sync logic */
export async function syncGmailJobs(options: {
  accessToken: string;
  profileId: string;
  adminClient: any;
  lastSyncedAt: string | null;
}): Promise<{ jobs: any[]; emailCount: number; report: SyncReport }> {
  const { accessToken, profileId, adminClient, lastSyncedAt } = options;

  // Step 1 — Search Gmail
  const rawQuery = buildGmailQuery(lastSyncedAt);
  console.log("[Gmail Sync] Search query:", rawQuery);
  console.log("[Gmail Sync] lastSyncedAt:", lastSyncedAt);

  const emptyReport = (): SyncReport => ({
    emailsScanned: 0,
    jobAlertsDetected: 0,
    jobsImported: 0,
    duplicatesSkipped: 0,
    emailsRejected: 0,
    parseFailures: 0,
    applicationsMatched: 0,
    query: rawQuery,
    emails: [],
  });

  const touchSync = () =>
    adminClient
      .from("gmail_sync_metadata")
      .upsert(
        { profile_id: profileId, last_synced_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      );

  const query = encodeURIComponent(rawQuery);
  const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;

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
  console.log("[Gmail Sync] resultSizeEstimate:", gmailData.resultSizeEstimate);

  if (!gmailData.messages?.length) {
    await touchSync();
    const report = emptyReport();
    logReport(report);
    return { jobs: [], emailCount: 0, report };
  }

  const messageIds = gmailData.messages.map((m: any) => m.id);
  console.log("[Gmail Sync] Messages found:", messageIds.length);

  // Step 2 — Fetch each email body
  type Email = {
    subject: string;
    from: string;
    body: string;
    bodyText: string;
    snippet: string;
    report: EmailReport;
  };
  const emails: Email[] = [];
  const emailReports: EmailReport[] = [];

  for (const msgId of messageIds) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) {
      emailReports.push({
        subject: `(message ${msgId})`,
        from: "",
        source: "Unknown",
        status: "rejected",
        reason: `Could not fetch email from Gmail (HTTP ${msgRes.status})`,
        method: "none",
        jobsFound: 0,
        jobsImported: 0,
        duplicates: 0,
      });
      continue;
    }
    const msg = await msgRes.json();

    const header = (name: string) =>
      msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === name)?.value || "";

    const subject = header("subject");
    const from = header("from");
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
    const body = bodyText.replace(/\s+/g, " ").trim();

    const report: EmailReport = {
      subject,
      from,
      source: inferSource(`${from} ${subject} ${body}`),
      status: "no_jobs",
      reason: null,
      method: "none",
      jobsFound: 0,
      jobsImported: 0,
      duplicates: 0,
    };
    emailReports.push(report);

    if (!body && !snippet) {
      report.status = "rejected";
      report.reason = "Email body could not be decoded (no readable text or HTML part)";
      continue;
    }

    emails.push({ subject, from, body, bodyText, snippet, report });
  }

  const emailsScanned = emailReports.length;

  // Step 3 — Pre-filter: only emails with job signals
  const relevantEmails = emails.filter((e) => {
    const isJobEmail = looksLikeJobEmail(`${e.from} ${e.subject} ${e.snippet} ${e.body}`);
    if (!isJobEmail) {
      e.report.status = "rejected";
      e.report.reason = "No job-alert signals found (no apply/view job/careers link or hiring language)";
    }
    return isJobEmail;
  });
  console.log(
    `Emails fetched: ${emailsScanned}, job alerts detected: ${relevantEmails.length}`
  );

  const finish = async (jobs: any[]) => {
    await touchSync();
    const applicationsMatched = await rematchApplications(adminClient, profileId);
    const report: SyncReport = {
      emailsScanned,
      jobAlertsDetected: relevantEmails.length,
      jobsImported: jobs.length,
      duplicatesSkipped: emailReports.reduce((n, e) => n + e.duplicates, 0),
      emailsRejected: emailReports.filter((e) => e.status === "rejected").length,
      parseFailures: emailReports.filter((e) => e.status === "parse_failed").length,
      applicationsMatched,
      query: rawQuery,
      emails: emailReports,
    };
    logReport(report);
    return { jobs, emailCount: relevantEmails.length, report };
  };

  if (relevantEmails.length === 0) {
    return await finish([]);
  }


  // Step 4 — AI extraction (one call per email)
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const allExtractedJobs: any[] = [];
  let aiUnavailable = false;

  for (const email of relevantEmails) {
    const { subject, body, snippet, report: er } = email;


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

    const pushFallbackJobs = (reason: string) => {
      const fallbackJobs = fallbackExtractJobsFromEmail(email);
      er.method = "fallback";
      if (fallbackJobs.length > 0) {
        for (const j of fallbackJobs) {
          j._sourceSubject = subject;
          j._report = er;
        }
        allExtractedJobs.push(...fallbackJobs);
        er.jobsFound += fallbackJobs.length;
        er.reason = `AI parse unavailable (${reason}) — rescued ${fallbackJobs.length} job(s) with the pattern parser`;
      } else {
        er.status = "parse_failed";
        er.reason = `Could not parse any job from this email (${reason}); pattern parser found no title/company pair`;
      }
      console.log(
        `[Gmail Sync] Fallback extracted ${fallbackJobs.length} jobs from: ${subject.slice(0, 60)} (${reason})`
      );
    };

    if (aiUnavailable) {
      pushFallbackJobs("AI quota exhausted");
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
        pushFallbackJobs(`AI request failed with HTTP ${status}`);
        continue;
      }

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const finishReason = aiData.choices?.[0]?.finish_reason;
      console.log(
        `[Gmail Sync] AI response for "${subject.slice(0, 50)}": ${raw.length} chars, finish_reason: ${finishReason}`
      );

      let cleaned = raw.replace(/```json|```/g, "").trim();
      let repaired = false;

      // Repair truncated JSON: if the response was cut off, try to close the array
      if (
        finishReason === "length" ||
        (!cleaned.endsWith("]") && cleaned.includes("{"))
      ) {
        repaired = true;
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
          j._report = er;
        }
        allExtractedJobs.push(...jobs);
        er.method = "ai";
        er.jobsFound += jobs.length;
        if (repaired) {
          er.reason = "AI response was truncated — repaired and recovered the complete listings";
        }
        console.log(
          `[Gmail Sync] Extracted ${jobs.length} jobs from: ${subject.slice(0, 60)}`
        );
      } else {
        pushFallbackJobs("AI returned no listings");
      }
    } catch (e) {
      console.error("AI extraction error for email:", subject, e);
      pushFallbackJobs(`AI response was not valid JSON: ${(e as Error).message}`);
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
        console.log("[Gmail Sync] No stored refresh token — Gmail not connected");
        return new Response(JSON.stringify({ error: "Gmail not connected. Please connect your Gmail account first.", notConnected: true, jobs: [], emailCount: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    // If token is expired/revoked, disable sync and return a friendly message
    if (err.message === "GOOGLE_TOKEN_EXPIRED") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseKey);
        const authHeader = req.headers.get("Authorization");
        const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
        const anonClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader! } },
        });
        const { data: { user } } = await anonClient.auth.getUser();
        if (user) {
          const { data: profile } = await adminClient.from("profiles").select("id").eq("user_id", user.id).single();
          if (profile) {
            await adminClient.from("gmail_sync_metadata").update({ enabled: false, refresh_token: null }).eq("profile_id", profile.id);
          }
        }
      } catch (disableErr) {
        console.error("Failed to disable sync after token expiry:", disableErr);
      }
      return new Response(JSON.stringify({ error: "Your Google connection has expired. Please re-connect Gmail to continue syncing jobs.", tokenExpired: true }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
