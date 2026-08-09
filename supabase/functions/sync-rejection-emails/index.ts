import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Token refresh failed:", res.status, err);
    if (err.includes("invalid_grant") || err.includes("expired")) throw new Error("GOOGLE_TOKEN_EXPIRED");
    throw new Error(`Failed to refresh Google token: ${res.status}`);
  }
  return (await res.json()).access_token;
}

function decodeBase64UrlToUtf8(base64Url: string): string {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function htmlToText(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|table|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function collectBody(payload: any): string {
  const plain: string[] = [];
  const html: string[] = [];
  const visit = (part: any) => {
    if (!part) return;
    const mime = String(part.mimeType || "").toLowerCase();
    const data = part.body?.data;
    if (typeof data === "string" && data.length > 0) {
      const decoded = decodeBase64UrlToUtf8(data);
      if (mime === "text/plain") plain.push(decoded);
      if (mime === "text/html") html.push(decoded);
    }
    if (Array.isArray(part.parts)) part.parts.forEach(visit);
  };
  visit(payload);
  if (plain.length) return plain.join("\n").trim();
  return htmlToText(html.join("\n"));
}

// ── Rejection detection ─────────────────────────────────────
const STRONG_SIGNALS = [
  "we have decided to move forward with other candidates",
  "we have decided to move forward with another candidate",
  "decided to move forward with other applicants",
  "we will not be moving forward",
  "will not be moving forward with your application",
  "not moving forward with your candidacy",
  "we are not able to offer you",
  "your application was not selected",
  "we have selected another candidate",
  "we've decided to pursue other candidates",
  "unfortunately, we have decided",
  "regret to inform you",
  "we regret to inform",
  "no longer under consideration",
  "not be progressing your application",
  "position has been filled",
  "pursue other applicants",
  "unable to move forward with your application",
  "we will not be advancing",
  "not be advancing your application",
  "decided to proceed with other",
  "moving ahead with other candidates",
  "we have chosen to move forward with",
  "we won't be moving forward",
  "you have not been selected",
  "we are unable to proceed with your application",
  "not to proceed with your application",
  "decided not to move forward",
];

const WEAK_SIGNALS = [
  "thank you for your interest in",
  "after careful consideration",
  "we appreciate the time you took to apply",
  "other candidates",
  "unfortunately",
  "not selected",
  "application status",
  "update on your application",
  "thank you for applying",
  "we appreciate your interest",
  "wish you the best in your job search",
  "we encourage you to apply",
  "keep your resume on file",
  "future opportunities",
  "this time",
];

const EXPLICIT_REASON_PATTERNS = [
  /because\s+([^.\n]{10,180})\./i,
  /due to\s+([^.\n]{10,180})\./i,
  /we (?:were )?looking for\s+([^.\n]{10,180})\./i,
  /candidates? with\s+(?:more|stronger)\s+([^.\n]{5,160})\./i,
  /the reason[^.\n]{0,20}:\s*([^.\n]{10,180})\./i,
];

function detect(text: string): { score: number; snippet: string; reason: string | null } {
  const lower = text.toLowerCase();
  let score = 0;
  let snippet = "";

  for (const s of STRONG_SIGNALS) {
    const idx = lower.indexOf(s);
    if (idx >= 0) {
      score += 0.6;
      if (!snippet) snippet = text.slice(Math.max(0, idx - 90), idx + s.length + 140).replace(/\s+/g, " ").trim();
      break;
    }
  }
  let weakHits = 0;
  for (const s of WEAK_SIGNALS) if (lower.includes(s)) weakHits++;
  score += Math.min(0.4, weakHits * 0.1);

  if (!snippet) {
    for (const s of WEAK_SIGNALS) {
      const idx = lower.indexOf(s);
      if (idx >= 0) {
        snippet = text.slice(Math.max(0, idx - 60), idx + 200).replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  let reason: string | null = null;
  for (const p of EXPLICIT_REASON_PATTERNS) {
    const m = text.match(p);
    if (m) {
      reason = m[0].replace(/\s+/g, " ").trim().slice(0, 240);
      break;
    }
  }

  return { score: Math.min(1, score), snippet: snippet.slice(0, 500), reason };
}

function headerValue(headers: any[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function senderDomainCompany(from: string): string {
  const m = from.match(/@([\w.-]+)/);
  if (!m) return "";
  const parts = m[1].split(".").filter((p) => !["com", "co", "org", "net", "io", "us", "uk", "inc"].includes(p));
  const core = parts[parts.length - 1] || parts[0] || "";
  const generic = ["greenhouse", "lever", "myworkday", "workday", "smartrecruiters", "icims", "taleo", "ashbyhq", "gmail", "google", "jobvite", "successfactors", "bamboohr", "hire", "notifications", "no-reply", "mail"];
  if (generic.includes(core.toLowerCase())) {
    const alt = parts.find((p) => !generic.includes(p.toLowerCase()));
    return alt ? titleCase(alt) : "";
  }
  return titleCase(core);
}

function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractCompany(from: string, subject: string, body: string): string {
  const displayName = from.split("<")[0].replace(/["']/g, "").trim();
  const bodyMatch =
    body.match(/your (?:application|interest) (?:to|at|with|in)\s+([A-Z][A-Za-z0-9&.,'\- ]{2,50})/) ||
    body.match(/interest in\s+(?:working at\s+)?([A-Z][A-Za-z0-9&.,'\- ]{2,50})/) ||
    subject.match(/\bat\s+([A-Z][A-Za-z0-9&.,'\- ]{2,40})/);
  if (bodyMatch) {
    const c = bodyMatch[1].replace(/\s+(and|the|for|our|team|careers?)$/i, "").trim();
    if (c.length > 1) return c;
  }
  const fromDomain = senderDomainCompany(from);
  if (fromDomain) return fromDomain;
  if (displayName && !/no.?reply|careers|talent|recruit|team|hiring/i.test(displayName)) return displayName;
  return displayName || "Unknown";
}

function extractRole(subject: string, body: string): string {
  const patterns = [
    /(?:your application (?:for|to)(?: the)?)\s+([A-Za-z0-9&/,'()\-. ]{3,70}?)(?:\s+(?:position|role|at|with|opening)|[.,\n])/i,
    /(?:application for(?: the)?)\s+([A-Za-z0-9&/,'()\-. ]{3,70}?)(?:\s+(?:position|role|at|with)|[.,\n])/i,
    /(?:the)\s+([A-Za-z0-9&/,'()\-. ]{3,70}?)\s+(?:position|role)\b/i,
  ];
  for (const src of [subject, body]) {
    for (const p of patterns) {
      const m = src.match(p);
      if (m) {
        const t = m[1].replace(/\s+/g, " ").trim();
        if (t.length > 2 && t.length < 80) return t;
      }
    }
  }
  const cleaned = subject
    .replace(/^(re|fwd|fw):\s*/i, "")
    .replace(/\b(update on your application|your application|application update|thank you for applying|regarding)\b/gi, "")
    .replace(/[-–|:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || "Unknown role";
}

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function similarity(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / Math.max(A.size, B.size);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const diagToken = Deno.env.get("REJECT_DIAG_TOKEN");
    const sentDiag = req.headers.get("x-diag-token");
    const isDiag = Boolean(diagToken && sentDiag && sentDiag === diagToken);

    let profile: { id: string } | null = null;
    if (isDiag) {
      const { data: meta } = await admin
        .from("gmail_sync_metadata")
        .select("profile_id")
        .not("refresh_token", "is", null)
        .limit(1)
        .maybeSingle();
      profile = meta ? { id: (meta as any).profile_id } : null;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Not authenticated");

      const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: p } = await admin.from("profiles").select("id").eq("user_id", user.id).single();
      profile = p as any;
    }
    if (!profile) throw new Error("Profile not found");


    const payload = await req.json().catch(() => ({}));
    const days = Math.min(90, Math.max(1, Number(payload.days) || 30));

    const { data: meta } = await admin
      .from("gmail_sync_metadata")
      .select("refresh_token, enabled")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!meta?.refresh_token) {
      return new Response(JSON.stringify({ notConnected: true, events: [], emailCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await refreshAccessToken(meta.refresh_token);

    const QUERIES = [
      '"regret to inform"',
      '"we regret"',
      '"not be moving forward"',
      '"will not be moving forward"',
      '"not moving forward"',
      '"move forward with other"',
      '"moving forward with other"',
      '"decided to move forward with"',
      '"other candidates"',
      '"other applicants"',
      '"another candidate"',
      '"not selected"',
      '"no longer under consideration"',
      '"position has been filled"',
      '"not be progressing"',
      '"unable to move forward"',
      '"after careful consideration"',
      'subject:("your application" OR "application update" OR "update on your application" OR "application status")',
    ];

    const idSet = new Set<string>();
    for (const q of QUERIES) {
      const full = `${q} newer_than:${days}d -category:promotions -category:social`;
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(full)}&maxResults=25`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!r.ok) {
        const t = await r.text();
        console.error("Gmail list failed", q, r.status, t);
        if (r.status === 401 || r.status === 403) throw new Error(`Gmail request failed (${r.status})`);
        continue;
      }
      const j = await r.json();
      for (const m of j.messages || []) idSet.add(m.id);
      if (idSet.size >= 150) break;
    }

    const ids: string[] = Array.from(idSet);

    const { data: existing } = await admin
      .from("rejection_events")
      .select("gmail_message_id")
      .eq("profile_id", profile.id);
    const seen = new Set((existing || []).map((e: any) => e.gmail_message_id));

    const { data: applications } = await admin
      .from("applications")
      .select("id, title, company, applied_date, recruiter_email, status")
      .eq("profile_id", profile.id);

    const detected: any[] = [];
    const debugRows: any[] = [];
    let scanned = 0;

    for (const id of ids) {
      if (seen.has(id)) continue;
      const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!mRes.ok) continue;
      const msg = await mRes.json();
      scanned++;
      const headers = msg.payload?.headers || [];
      const subject = headerValue(headers, "Subject");
      const from = headerValue(headers, "From");
      const body = collectBody(msg.payload) || msg.snippet || "";
      const combined = `${subject}\n${body}`;

      const { score, snippet, reason } = detect(combined);
      debugRows.push({ subject: subject.slice(0, 90), from: from.slice(0, 60), score });
      if (score < 0.35) continue;

      const company = extractCompany(from, subject, body);
      const role = extractRole(subject, body);
      const receivedAt = new Date(Number(msg.internalDate || Date.now())).toISOString();

      // Match against applications
      let best: any = null;
      let bestScore = 0;
      for (const app of applications || []) {
        const companySim = similarity(app.company, company) || (norm(company) && norm(app.company).includes(norm(company)) ? 0.8 : 0);
        const titleSim = similarity(app.title, role);
        const emailMatch = app.recruiter_email && from.toLowerCase().includes(app.recruiter_email.toLowerCase()) ? 0.3 : 0;
        const dateOk = app.applied_date && new Date(app.applied_date).getTime() <= new Date(receivedAt).getTime() + 86400000 ? 0.1 : 0;
        const m = companySim * 0.6 + titleSim * 0.3 + emailMatch + dateOk;
        if (m > bestScore) {
          bestScore = m;
          best = app;
        }
      }

      const confidence = Math.min(1, Number((score * 0.5 + bestScore * 0.5).toFixed(2)));
      const matched = best && bestScore >= 0.55 && score >= 0.6;

      const row = {
        profile_id: profile.id,
        application_id: matched ? best.id : null,
        gmail_message_id: id,
        company: matched ? best.company : company,
        role_title: matched ? best.title : role,
        received_at: receivedAt,
        evidence_snippet: snippet || (msg.snippet || "").slice(0, 500),
        email_subject: subject,
        sender: from,
        confidence,
        match_status: matched ? "matched" : "needs_review",
        explicit_reason: reason,
      };

      const { data: inserted, error: insErr } = await admin
        .from("rejection_events")
        .upsert(row, { onConflict: "profile_id,gmail_message_id" })
        .select()
        .maybeSingle();
      if (insErr) {
        console.error("insert rejection event failed", JSON.stringify(insErr));
        debugRows.push({ insertError: insErr.message });
        continue;
      }
      detected.push(inserted);

      if (matched && best.status !== "rejected") {
        await admin
          .from("applications")
          .update({ status: "rejected", last_email_date: receivedAt.slice(0, 10) })
          .eq("id", best.id);
        await admin.from("application_status_events").insert({
          application_id: best.id,
          profile_id: profile.id,
          status: "rejected",
          source: "Gmail sync",
          entered_at: receivedAt,
        });
      }
    }

    await admin
      .from("gmail_sync_metadata")
      .upsert({ profile_id: profile.id, last_rejection_sync_at: new Date().toISOString() }, { onConflict: "profile_id" });

    return new Response(
      JSON.stringify({
        events: detected,
        emailCount: scanned,
        matched: detected.filter((d) => d.match_status === "matched").length,
        needsReview: detected.filter((d) => d.match_status === "needs_review").length,
        debug: { idsFound: ids.length, alreadySeen: seen.size, scanned, samples: debugRows.slice(0, 25) },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("sync-rejection-emails error:", err);
    if (err.message === "GOOGLE_TOKEN_EXPIRED") {
      return new Response(JSON.stringify({ error: "Your Google connection expired. Please reconnect Gmail.", tokenExpired: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err.message || "Rejection sync failed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
