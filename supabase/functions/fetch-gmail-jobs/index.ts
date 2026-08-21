import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { callConfiguredAI } from "../_shared/ai-provider.ts";

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
    // Application confirmations (roles the user applied to directly)
    '"your application was sent"',
    '"application was sent to"',
    '"thank you for applying"',
    '"thanks for applying"',
    '"we received your application"',
    '"your application has been received"',
    '"application received"',
    '"application submitted"',
    '"you applied to"',
    '"indeed application"',
  ].join(" OR ");

  return `(${senders} OR ${phrases}) newer_than:${daysSinceSync}d`;
}

/** ---- Application confirmation detection ("I applied to this role") ---- */
const APPLICATION_SIGNALS = [
  "your application was sent",
  "application was sent to",
  "thank you for applying",
  "thanks for applying",
  "we received your application",
  "your application has been received",
  "application received",
  "application submitted",
  "you applied to",
  "indeed application",
  "application confirmation",
];

export function looksLikeApplicationEmail(text: string): boolean {
  const lower = (text || "").toLowerCase();
  return APPLICATION_SIGNALS.some((s) => lower.includes(s));
}

/**
 * Parse "you applied" confirmation emails into { title, company }.
 * Handles LinkedIn ("Your application was sent to <Company>" + role in body),
 * Indeed ("Indeed Application: <Title>"), and generic ATS confirmations
 * ("Thank you for applying to <Company>" / "... for the <Title> role").
 */
export function parseApplicationConfirmation(
  subject: string,
  from: string,
  body: string
): { title: string; company: string } | null {
  const s = cleanTextLine(subject || "");
  const b = (body || "").replace(/\s+/g, " ").trim();
  const strip = (v: string) =>
    cleanTextLine(v || "")
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[.,!]+$/, "")
      .replace(/\s+(role|position|opening|job|opportunity)$/i, "")
      .trim();

  let title = "";
  let company = "";

  // LinkedIn: subject "Your application was sent to Acme Corp"
  let m = s.match(/your application was sent to\s+(.+)$/i) || b.match(/your application was sent to\s+([^.·|]+)/i);
  if (m) {
    company = strip(m[1]);
    // Role usually appears in the body right before the company
    const roleMatch =
      b.match(/(?:applied for|application for)\s+([^.·|]{3,80}?)\s+at\s+([^.·|]{2,60})/i) ||
      b.match(/^([^.·|]{3,80}?)\s+·\s+/);
    if (roleMatch) {
      title = strip(roleMatch[1]);
      if (!company && roleMatch[2]) company = strip(roleMatch[2]);
    }
  }

  // Indeed: "Indeed Application: Product Manager" (+ company in body)
  if (!title) {
    m = s.match(/indeed application[:\-]\s*(.+)$/i);
    if (m) {
      title = strip(m[1]);
      const c = b.match(/\bat\s+([A-Z][\w&.,'’\- ]{2,60})/);
      if (c) company = strip(c[1]);
    }
  }

  // Generic: "Thank you for applying to <Company>" / "... to the <Title> position at <Company>"
  if (!title || !company) {
    const g =
      s.match(/(?:thank you|thanks) for applying (?:to|for)\s+(?:the\s+)?([^.·|]{3,80}?)\s+(?:role|position|job)?\s*(?:at|with)\s+([^.·|]{2,60})$/i) ||
      b.match(/(?:thank you|thanks) for applying (?:to|for)\s+(?:the\s+)?([^.·|]{3,80}?)\s+(?:role|position|job)?\s*(?:at|with)\s+([^.·|]{2,60})/i);
    if (g) {
      title = title || strip(g[1]);
      company = company || strip(g[2]);
    } else {
      const c =
        s.match(/(?:thank you|thanks) for applying (?:to|at|with)\s+([^.·|]{2,60})$/i) ||
        b.match(/(?:thank you|thanks) for applying (?:to|at|with)\s+([^.·|]{2,60})/i) ||
        s.match(/we received your application (?:to|at|for)\s+([^.·|]{2,60})$/i);
      if (c) company = company || strip(c[1]);
      const t =
        b.match(/(?:for the|for your application to the)\s+([^.·|]{3,80}?)\s+(?:role|position|opening)/i) ||
        s.match(/application (?:received|submitted)[:\-]\s*(.+)$/i) ||
        b.match(/\b(?:position|role)[:\s]+([A-Z][^.·|]{3,60})/);
      if (t) title = title || strip(t[1]);
    }
  }

  if (!company) {
    // Fall back to the sender's domain as the company name
    const dom = (from || "").match(/@([\w.-]+)/)?.[1] || "";
    const base = dom.split(".").filter((p) => !["com", "net", "org", "io", "co", "mail", "www", "us"].includes(p)).pop();
    if (base && !["linkedin", "indeed", "greenhouse", "lever", "myworkday", "workday"].includes(base)) {
      company = base.charAt(0).toUpperCase() + base.slice(1);
    }
  }

  if (!company) return null;
  return { title: title || "Role not specified", company };
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

/** Core sync logic *//** Core sync logic */

export type SyncStage =
  | "auth"
  | "profile"
  | "token"
  | "token_refresh"
  | "gmail_search"
  | "gmail_pagination"
  | "gmail_fetch_message"
  | "parse"
  | "dedupe"
  | "persist"
  | "summary";

export class SyncError extends Error {
  stage: SyncStage;
  code: string;
  httpStatus?: number;
  constructor(stage: SyncStage, code: string, message: string, httpStatus?: number) {
    super(message);
    this.stage = stage;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface SyncErrorItem {
  stage: SyncStage;
  code: string;
  message: string;
}

export interface SyncResult {
  success: boolean;
  requestId: string;
  scanned: number;
  imported: number;
  skipped: number;
  failed: number;
  syncStartedAt: string;
  syncCompletedAt: string;
  errors: SyncErrorItem[];
  report: SyncReport | null;
  jobs: any[];
  tokenExpired?: boolean;
  notConnected?: boolean;
}

/** Structured, PII-safe stage logging */
export function makeLogger(requestId: string, userId: string) {
  return (
    stage: SyncStage,
    status: "start" | "ok" | "warn" | "error",
    fields: Record<string, unknown> = {}
  ) => {
    const parts = Object.entries(fields)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`)
      .join(" ");
    console.log(
      `[gmail-sync] rid=${requestId} uid=${userId} stage=${stage} status=${status} at=${new Date().toISOString()} ${parts}`
    );
  };
}

/** Map a Gmail API HTTP status to a safe, explicit error */
export function gmailHttpError(stage: SyncStage, status: number): SyncError {
  if (status === 401)
    return new SyncError(stage, "GMAIL_UNAUTHORIZED", "Gmail rejected the access token (401). Please re-connect Gmail.", status);
  if (status === 403)
    return new SyncError(stage, "GMAIL_FORBIDDEN", "Gmail denied access (403). The gmail.readonly permission may not have been granted.", status);
  if (status === 429)
    return new SyncError(stage, "GMAIL_RATE_LIMITED", "Gmail rate limit reached (429). Please try again in a few minutes.", status);
  if (status >= 500)
    return new SyncError(stage, "GMAIL_SERVER_ERROR", `Gmail is temporarily unavailable (${status}). Please retry shortly.`, status);
  return new SyncError(stage, "GMAIL_REQUEST_FAILED", `Gmail request failed with HTTP ${status}.`, status);
}

const OVERALL_BUDGET_MS = 100_000;
const MAX_MESSAGES = 60;
const MAX_DESCRIPTION_FETCHES = 8;

export async function syncGmailJobs(options: {
  accessToken: string;
  profileId: string;
  adminClient: any;
  lastSyncedAt: string | null;
  requestId?: string;
  userId?: string;
}): Promise<{ jobs: any[]; emailCount: number; report: SyncReport; errors: SyncErrorItem[] }> {
  const { accessToken, profileId, adminClient, lastSyncedAt } = options;
  const requestId = options.requestId ?? crypto.randomUUID();
  const log = makeLogger(requestId, options.userId ?? profileId);
  const startedMs = Date.now();
  const outOfBudget = () => Date.now() - startedMs > OVERALL_BUDGET_MS;
  const errors: SyncErrorItem[] = [];
  const noteError = (e: SyncError) => {
    errors.push({ stage: e.stage, code: e.code, message: e.message });
    log(e.stage, "error", { code: e.code, message: e.message });
  };

  const rawQuery = buildGmailQuery(lastSyncedAt);
  log("gmail_search", "start", { lastSyncedAt: lastSyncedAt ?? "never", queryLength: rawQuery.length });

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

  // ── Stage: Gmail search (with pagination) ──
  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let page = 0;
  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", rawQuery);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new SyncError(
        page === 0 ? "gmail_search" : "gmail_pagination",
        "GMAIL_NETWORK_ERROR",
        `Could not reach Gmail: ${(e as Error).name === "TimeoutError" ? "request timed out" : "network error"}.`
      );
    }

    if (!res.ok) {
      const err = gmailHttpError(page === 0 ? "gmail_search" : "gmail_pagination", res.status);
      // Pagination failures are non-fatal — keep what we already have
      if (page > 0) {
        noteError(err);
        break;
      }
      throw err;
    }

    const data = await res.json();
    for (const m of data.messages ?? []) messageIds.push(m.id);
    pageToken = data.nextPageToken;
    page++;
  } while (pageToken && messageIds.length < MAX_MESSAGES && page < 3 && !outOfBudget());

  log("gmail_search", "ok", { pages: page, messages: messageIds.length });

  if (messageIds.length === 0) {
    await touchSync();
    const report = emptyReport();
    logReport(report);
    return { jobs: [], emailCount: 0, report, errors };
  }

  // ── Stage: fetch message bodies ──
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

  const ids = messageIds.slice(0, MAX_MESSAGES);
  const CHUNK = 6;
  for (let i = 0; i < ids.length; i += CHUNK) {
    if (outOfBudget()) {
      noteError(new SyncError("gmail_fetch_message", "TIME_BUDGET_EXCEEDED", "Sync stopped early to stay within the time limit — remaining emails will be picked up on the next sync."));
      break;
    }
    const chunk = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (msgId) => {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) }
          );
          if (!msgRes.ok) return { error: gmailHttpError("gmail_fetch_message", msgRes.status) };
          return { msg: await msgRes.json() };
        } catch (e) {
          return {
            error: new SyncError("gmail_fetch_message", "GMAIL_NETWORK_ERROR", `Could not download an email from Gmail (${(e as Error).name}).`),
          };
        }
      })
    );

    for (const r of results) {
      if ("error" in r && r.error) {
        emailReports.push({
          subject: "(unavailable)",
          from: "",
          source: "Unknown",
          status: "rejected",
          reason: r.error.message,
          method: "none",
          jobsFound: 0,
          jobsImported: 0,
          duplicates: 0,
        });
        noteError(r.error);
        continue;
      }
      const msg = (r as any).msg;

      const header = (name: string) =>
        msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === name)?.value || "";

      const subject = header("subject");
      const from = header("from");
      const snippet = (msg.snippet || "").replace(/\s+/g, " ").trim();

      const { textPlain, textHtml } = collectMessageBodies(msg.payload);

      let rawBody = "";
      if (textPlain.length > 0) rawBody = textPlain.join("\n");
      else if (textHtml.length > 0) rawBody = textHtml.join("\n");
      else if (msg.payload?.body?.data)
        rawBody = decodeQuotedPrintable(decodeBase64UrlToUtf8(msg.payload.body.data));

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
        report.status = "parse_failed";
        report.reason = "Email body could not be decoded (no readable text or HTML part)";
        continue;
      }

      emails.push({ subject, from, body, bodyText, snippet, report });
    }
  }

  const emailsScanned = emailReports.length;
  log("gmail_fetch_message", "ok", { scanned: emailsScanned });

  // ── Stage: application confirmations ("your application was sent to …") ──
  const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
  let applicationsImported = 0;
  const applicationEmails = emails.filter((e) =>
    looksLikeApplicationEmail(`${e.subject} ${e.snippet} ${e.body}`)
  );

  if (applicationEmails.length > 0) {
    try {
      const { data: existingApps } = await adminClient
        .from("applications")
        .select("id, title, company")
        .eq("profile_id", profileId);
      const seen = new Set((existingApps ?? []).map((a: any) => `${norm(a.title)}__${norm(a.company)}`));

      for (const e of applicationEmails) {
        const parsed = parseApplicationConfirmation(e.subject, e.from, `${e.bodyText}\n${e.snippet}`);
        if (!parsed) {
          e.report.status = "parse_failed";
          e.report.reason = "Looked like an application confirmation but company/role could not be identified";
          continue;
        }
        const key = `${norm(parsed.title)}__${norm(parsed.company)}`;
        if (seen.has(key)) {
          e.report.status = "duplicate";
          e.report.reason = "Application already tracked";
          e.report.duplicates += 1;
          continue;
        }
        const { error } = await adminClient.from("applications").insert({
          profile_id: profileId,
          title: parsed.title,
          company: parsed.company,
          status: "applied",
          applied_date: new Date().toISOString().slice(0, 10),
          notes: `Imported from Gmail application confirmation (${inferSource(`${e.from} ${e.subject}`)})`,
        });
        if (error) {
          e.report.status = "parse_failed";
          e.report.reason = "Could not save the application record";
          continue;
        }
        seen.add(key);
        applicationsImported++;
        e.report.status = "application";
        e.report.reason = `Tracked application: ${parsed.title} at ${parsed.company}`;
      }
    } catch {
      noteError(new SyncError("persist", "APPLICATION_IMPORT_FAILED", "Could not import application confirmation emails."));
    }
  }
  const applicationEmailSet = new Set(applicationEmails);
  log("parse", "ok", { applicationEmails: applicationEmails.length, applicationsImported });

  // ── Stage: relevance pre-filter ──
  const relevantEmails = emails.filter((e) => {
    if (applicationEmailSet.has(e)) return false;
    const isJobEmail = looksLikeJobEmail(`${e.from} ${e.subject} ${e.snippet} ${e.body}`);
    if (!isJobEmail) {
      e.report.status = "rejected";
      e.report.reason = "No job-alert signals found (no apply/view job/careers link or hiring language)";
    }
    return isJobEmail;
  });
  log("parse", "start", { scanned: emailsScanned, jobAlerts: relevantEmails.length });

  const finish = async (jobs: any[]) => {
    await touchSync();
    let applicationsMatched = 0;
    try {
      applicationsMatched = await rematchApplications(adminClient, profileId);
    } catch (e) {
      noteError(new SyncError("persist", "APPLICATION_MATCH_FAILED", "Could not re-match applications to imported jobs."));
    }
    const report: SyncReport = {
      emailsScanned,
      jobAlertsDetected: relevantEmails.length,
      jobsImported: jobs.length,
      duplicatesSkipped: emailReports.reduce((n, e) => n + e.duplicates, 0),
      emailsRejected: emailReports.filter((e) => e.status === "rejected").length,
      parseFailures: emailReports.filter((e) => e.status === "parse_failed").length,
      applicationsMatched,
      applicationsImported,
      query: rawQuery,
      emails: emailReports,
    };

    logReport(report);
    log("summary", "ok", {
      scanned: report.emailsScanned,
      imported: report.jobsImported,
      duplicates: report.duplicatesSkipped,
      rejected: report.emailsRejected,
      parseFailures: report.parseFailures,
      durationMs: Date.now() - startedMs,
    });
    return { jobs, emailCount: relevantEmails.length, report, errors };
  };

  if (relevantEmails.length === 0) return await finish([]);

  // ── Stage: extraction ──
  const allExtractedJobs: any[] = [];
  let aiUnavailable = false;

  for (const email of relevantEmails) {
    const { subject, body, snippet, report: er } = email;

    const pushFallbackJobs = (reason: string) => {
      let fallbackJobs: any[] = [];
      try {
        fallbackJobs = fallbackExtractJobsFromEmail(email);
      } catch (e) {
        fallbackJobs = [];
      }
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
    };

    if (aiUnavailable || outOfBudget()) {
      pushFallbackJobs(outOfBudget() ? "time budget reached" : "AI unavailable");
      continue;
    }

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
- Keep snippet SHORT (under 100 chars)
- Return raw JSON array only`;

    try {
      const aiResult = await callConfiguredAI({
        requestId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        maxTokens: 1200,
      });
      if (!aiResult) {
        aiUnavailable = true;
        noteError(new SyncError("parse", "AI_UNAVAILABLE", "No configured AI provider responded — used the pattern parser instead."));
        pushFallbackJobs("all configured AI providers failed");
        continue;
      }
      const raw = aiResult.text;
      const finishReason = undefined;

      let cleaned = raw.replace(/```json|```/g, "").trim();
      let repaired = false;
      if (finishReason === "length" || (!cleaned.endsWith("]") && cleaned.includes("{"))) {
        repaired = true;
        const lastCompleteObj = cleaned.lastIndexOf("}");
        if (lastCompleteObj > 0) {
          cleaned = cleaned.slice(0, lastCompleteObj + 1);
          if (!cleaned.endsWith("]")) cleaned += "]";
          if (!cleaned.startsWith("[")) cleaned = "[" + cleaned;
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
        if (repaired) er.reason = "AI response was truncated — repaired and recovered the listings";
      } else {
        pushFallbackJobs("AI returned no listings");
      }
    } catch (e) {
      pushFallbackJobs(`AI response was not usable: ${(e as Error).name}`);
      continue;
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  // ── Stage: dedupe ──
  const normalize = (str: string) => str?.toLowerCase().trim().replace(/\s+/g, " ") || "";

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: existingJobs, error: existingErr } = await adminClient
    .from("imported_jobs")
    .select("title, company")
    .eq("profile_id", profileId)
    .gte("imported_at", sixtyDaysAgo);

  if (existingErr) {
    noteError(new SyncError("dedupe", "DB_READ_FAILED", "Could not read previously imported jobs — duplicates may be re-imported."));
  }

  const existingSet = new Set(
    existingJobs?.map((j: any) => `${normalize(j.title)}__${normalize(j.company)}`) || []
  );

  const seenInBatch = new Set<string>();
  const newJobs = allExtractedJobs.filter((j) => {
    const rep: EmailReport | undefined = j._report;
    if (!j.title || !j.company) {
      if (rep) {
        rep.jobsFound = Math.max(0, rep.jobsFound - 1);
        if (rep.jobsFound === 0 && rep.status !== "rejected") {
          rep.status = "parse_failed";
          rep.reason = "Parsed listing was missing a title or company name";
        }
      }
      return false;
    }
    const key = `${normalize(j.title)}__${normalize(j.company)}`;
    if (existingSet.has(key) || seenInBatch.has(key)) {
      if (rep) rep.duplicates += 1;
      return false;
    }
    seenInBatch.add(key);
    if (rep) rep.jobsImported += 1;
    return true;
  });

  for (const rep of emailReports) {
    if (rep.status === "rejected" || rep.status === "parse_failed") continue;
    if (rep.jobsImported > 0) rep.status = "imported";
    else if (rep.duplicates > 0) {
      rep.status = "duplicate";
      rep.reason = `All ${rep.duplicates} listing(s) already imported previously`;
    } else if (rep.jobsFound === 0) {
      rep.status = "no_jobs";
      rep.reason = rep.reason ?? "No open roles were listed in this email";
    }
  }

  log("dedupe", "ok", { extracted: allExtractedJobs.length, newJobs: newJobs.length });

  // ── Stage: enrich (best effort, budget-capped) ──
  let enriched = 0;
  for (const job of newJobs) {
    job._description = null;
    job._urlVerified = false;
    job._descriptionFetchedAt = null;
    if (!job.url || enriched >= MAX_DESCRIPTION_FETCHES || outOfBudget()) continue;
    enriched++;
    const { description, urlVerified } = await fetchJobDescription(job.url);
    job._description = description;
    job._urlVerified = urlVerified;
    job._descriptionFetchedAt = new Date().toISOString();
  }

  // ── Stage: persist ──
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
      .upsert(rows, { onConflict: "profile_id,title,company", ignoreDuplicates: true });

    if (insertErr) {
      log("persist", "error", { code: "DB_INSERT_FAILED" });
      throw new SyncError("persist", "DB_INSERT_FAILED", "Could not save the imported jobs to the database.");
    }
    log("persist", "ok", { inserted: rows.length });
  }

  return await finish(newJobs);
}

/** Build the structured API response shape from a report */
export function buildSyncResult(params: {
  requestId: string;
  report: SyncReport | null;
  jobs: any[];
  errors: SyncErrorItem[];
  syncStartedAt: string;
  success: boolean;
  extra?: Record<string, unknown>;
}): SyncResult {
  const { report, jobs, errors, requestId, syncStartedAt, success } = params;
  return {
    success,
    requestId,
    scanned: report?.emailsScanned ?? 0,
    imported: report?.jobsImported ?? 0,
    skipped: report ? report.duplicatesSkipped + report.emailsRejected : 0,
    failed: report?.parseFailures ?? 0,
    syncStartedAt,
    syncCompletedAt: new Date().toISOString(),
    errors,
    report,
    jobs,
    ...(params.extra ?? {}),
  };
}

async function saveSummary(adminClient: any, profileId: string, result: SyncResult) {
  try {
    await adminClient.from("gmail_sync_metadata").upsert(
      {
        profile_id: profileId,
        last_sync_status: result.success ? "success" : "error",
        last_sync_summary: {
          scanned: result.scanned,
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          errors: result.errors,
          report: result.report,
        },
        last_sync_started_at: result.syncStartedAt,
        last_sync_completed_at: result.syncCompletedAt,
        last_sync_error: result.errors[0]?.message ?? null,
      },
      { onConflict: "profile_id" }
    );
  } catch (e) {
    console.error(`[gmail-sync] rid=${result.requestId} stage=summary status=error code=SUMMARY_SAVE_FAILED`);
  }
}

// ─── HTTP handler (manual trigger from frontend) ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const syncStartedAt = new Date().toISOString();
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let adminClient: any = null;
  let profileId: string | null = null;
  let log = makeLogger(requestId, "anonymous");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new SyncError("auth", "NOT_AUTHENTICATED", "You are signed out. Please sign in again.");

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user)
      throw new SyncError("auth", "NOT_AUTHENTICATED", "Your session has expired. Please sign in again.");

    log = makeLogger(requestId, user.id);
    log("auth", "ok");

    adminClient = createClient(supabaseUrl, supabaseKey);

    const { data: profile } = await adminClient
      .from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile) throw new SyncError("profile", "PROFILE_NOT_FOUND", "We could not find your profile record.");
    profileId = profile.id;
    log("profile", "ok");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { providerToken, refreshToken } = body;

    let accessToken: string | null = providerToken ?? null;
    log("token", "start", { providerToken: accessToken ? "present" : "missing" });

    if (refreshToken) {
      await adminClient
        .from("gmail_sync_metadata")
        .upsert({ profile_id: profileId, refresh_token: refreshToken }, { onConflict: "profile_id" });
    }

    if (!accessToken) {
      const storedToken = refreshToken ?? (await adminClient
        .from("gmail_sync_metadata")
        .select("refresh_token")
        .eq("profile_id", profileId)
        .maybeSingle()).data?.refresh_token;

      if (!storedToken) {
        log("token", "warn", { code: "GMAIL_NOT_CONNECTED" });
        const result = buildSyncResult({
          requestId, report: null, jobs: [], syncStartedAt, success: false,
          errors: [{ stage: "token", code: "GMAIL_NOT_CONNECTED", message: "Gmail is not connected. Connect your Gmail account to import job alerts." }],
          extra: { notConnected: true, error: "Gmail not connected. Please connect your Gmail account first.", emailCount: 0 },
        });
        return json(result);
      }

      log("token_refresh", "start");
      accessToken = await refreshAccessToken(storedToken);
      log("token_refresh", "ok");
    }

    const { data: syncMeta } = await adminClient
      .from("gmail_sync_metadata")
      .select("last_synced_at")
      .eq("profile_id", profileId)
      .maybeSingle();

    const { jobs, report, errors } = await syncGmailJobs({
      accessToken: accessToken!,
      profileId: profileId!,
      adminClient,
      lastSyncedAt: syncMeta?.last_synced_at || null,
      requestId,
      userId: user.id,
    });

    const result = buildSyncResult({
      requestId, report, jobs, errors, syncStartedAt, success: true,
      extra: { emailCount: report.jobAlertsDetected },
    });
    await saveSummary(adminClient, profileId!, result);
    return json(result);
  } catch (rawErr: any) {
    const err: SyncError =
      rawErr instanceof SyncError
        ? rawErr
        : rawErr?.message === "GOOGLE_TOKEN_EXPIRED"
        ? new SyncError("token_refresh", "GOOGLE_TOKEN_EXPIRED", "Your Google connection has expired. Please re-connect Gmail to continue syncing jobs.")
        : typeof rawErr?.message === "string" && rawErr.message.startsWith("Failed to refresh Google token")
        ? new SyncError("token_refresh", "OAUTH_REFRESH_FAILED", "Google refused to refresh your Gmail access. Please re-connect Gmail.")
        : new SyncError("summary", "UNEXPECTED_ERROR", "The sync failed unexpectedly. Please retry.");

    log(err.stage, "error", { code: err.code, message: err.message, httpStatus: err.httpStatus });
    console.error(`[gmail-sync] rid=${requestId} unhandled:`, rawErr?.name, rawErr?.message);

    if (err.code === "GOOGLE_TOKEN_EXPIRED" && adminClient && profileId) {
      try {
        await adminClient
          .from("gmail_sync_metadata")
          .update({ enabled: false, refresh_token: null })
          .eq("profile_id", profileId);
      } catch { /* non-fatal */ }
    }

    const result = buildSyncResult({
      requestId, report: null, jobs: [], syncStartedAt, success: false,
      errors: [{ stage: err.stage, code: err.code, message: err.message }],
      extra: {
        error: err.message,
        tokenExpired: err.code === "GOOGLE_TOKEN_EXPIRED" || err.code === "GMAIL_UNAUTHORIZED",
        emailCount: 0,
      },
    });

    if (adminClient && profileId) await saveSummary(adminClient, profileId, result);
    return json(result);
  }
});
