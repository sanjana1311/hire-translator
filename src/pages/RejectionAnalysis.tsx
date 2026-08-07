import { useEffect, useMemo, useState } from "react";
import { callAI } from "@/lib/ai";
import { AIQuotaBadge } from "@/components/AIQuotaBadge";
import { useProfile } from "@/hooks/use-profile";
import { useResume } from "@/hooks/use-resume";
import { useRejectionEvents, RejectionEvent } from "@/hooks/use-rejection-events";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { supabase } from "@/integrations/supabase/client";
import { safeParseJSON } from "@/lib/safe-json";
import { toast } from "sonner";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-foreground/10 border-t-foreground/60 rounded-full animate-spin" style={{ width: size, height: size }} />
);

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

interface RejectionAnalysisData {
  patterns?: string[];
  likelyPattern?: string;
  repeatedMissingSkills?: string[];
  resumeToJobGaps?: { company?: string; role?: string; gaps?: string[] }[];
  levelObservation?: string;
  industryObservation?: string;
  practicalImprovements?: string[];
  recommendedRoleTypes?: string[];
  error?: boolean;
}

interface AppRow {
  id: string;
  title: string;
  company: string;
  status: string;
  applied_date: string | null;
  notes: string | null;
  imported_job_id: string | null;
}

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d?: string | null) {
  if (!d) return "never";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const RejectionAnalysis = () => {
  const { data: profile } = useProfile();
  const { data: resume } = useResume();
  const { connectGmail } = useGmailImport(profile?.id ?? null);
  const {
    events,
    loading: syncing,
    syncState,
    syncError,
    lastSyncedAt,
    gmailConnected,
    sync,
    confirmMatch,
    dismissEvent,
    deleteAllSyncedEmails,
    disconnectGmail,
  } = useRejectionEvents(profile?.id ?? null);

  const [days, setDays] = useState(7);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<RejectionAnalysisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const [{ data: a }, { data: j }] = await Promise.all([
        supabase.from("applications").select("id, title, company, status, applied_date, notes, imported_job_id").eq("profile_id", profile.id),
        supabase.from("imported_jobs").select("id, title, company, description, analysis").eq("profile_id", profile.id),
      ]);
      setApps((a ?? []) as AppRow[]);
      setJobs(j ?? []);
    })();
  }, [profile?.id]);

  const cutoff = useMemo(() => Date.now() - days * 86400000, [days]);

  const inRangeEvents = useMemo(
    () => events.filter((e) => e.match_status !== "dismissed" && new Date(e.received_at).getTime() >= cutoff),
    [events, cutoff],
  );
  const matchedEvents = useMemo(() => inRangeEvents.filter((e) => e.match_status === "matched"), [inRangeEvents]);
  const reviewEvents = useMemo(() => inRangeEvents.filter((e) => e.match_status === "needs_review"), [inRangeEvents]);

  const rejectedApps = useMemo(
    () => apps.filter((a) => a.status === "rejected" && (!a.applied_date || new Date(a.applied_date).getTime() >= cutoff - 180 * 86400000)),
    [apps, cutoff],
  );

  const rows = useMemo(() => {
    const byApp = new Map<string, RejectionEvent>();
    matchedEvents.forEach((e) => e.application_id && byApp.set(e.application_id, e));
    const list = matchedEvents.map((e) => {
      const app = apps.find((a) => a.id === e.application_id);
      const job = jobs.find((j) => j.id === app?.imported_job_id) || jobs.find((j) => j.company?.toLowerCase() === e.company.toLowerCase());
      return { event: e, app, job };
    });
    // include rejected applications with no matched email
    rejectedApps.forEach((a) => {
      if (byApp.has(a.id)) return;
      const job = jobs.find((j) => j.id === a.imported_job_id);
      list.push({ event: undefined as any, app: a, job });
    });
    return list;
  }, [matchedEvents, rejectedApps, apps, jobs]);

  const analyze = async () => {
    if (rows.length === 0) {
      setAnalysisError("No rejected roles in this date range to analyze.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const resumeText = (resume?.raw_text || "").slice(0, 6000);
      const skills = Array.isArray(resume?.skills) ? resume!.skills.join(", ") : "";

      const rejectionBlock = rows
        .slice(0, 15)
        .map(({ event, app, job }) => {
          const ats = job?.analysis?.score ?? job?.analysis?.atsScore;
          const missing = job?.analysis?.missingKeywords || job?.analysis?.gaps;
          return [
            `Company: ${app?.company || event?.company}`,
            `Role: ${app?.title || event?.role_title}`,
            `Rejection date: ${fmt(event?.received_at || app?.applied_date)}`,
            event?.explicit_reason ? `Stated reason in email: ${event.explicit_reason}` : "Stated reason in email: none",
            event?.evidence_snippet ? `Email evidence: ${event.evidence_snippet.slice(0, 300)}` : "",
            ats != null ? `ATS/match score: ${ats}` : "",
            missing ? `Known gaps: ${JSON.stringify(missing).slice(0, 400)}` : "",
            job?.description ? `Job description excerpt: ${String(job.description).slice(0, 900)}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n---\n");

      const prompt = `You are a careful career strategist. You analyse rejection evidence WITHOUT inventing causes.
STRICT RULE: never claim you know the exact reason for a rejection unless the email explicitly states it. Use hedged language: "Likely pattern", "Possible gap", "The available evidence suggests".

CANDIDATE TARGET ROLES: ${profile?.target_roles || "not specified"}
RESUME SKILLS: ${skills || "not provided"}
RESUME TEXT:
${resumeText || "not provided"}

REJECTED APPLICATIONS (last ${days} days):
${rejectionBlock}

Return ONLY valid JSON matching this schema, no markdown:
{
  "likelyPattern": "one hedged sentence naming the strongest recurring signal",
  "patterns": ["3 hedged patterns across role level, industry, company type and job category"],
  "repeatedMissingSkills": ["skills or requirements missing across multiple job descriptions"],
  "resumeToJobGaps": [{"company":"","role":"","gaps":["specific resume-to-JD gaps"]}],
  "levelObservation": "hedged observation about role level/seniority alignment",
  "industryObservation": "hedged observation about industry/company category alignment",
  "practicalImprovements": ["4 concrete, actionable changes"],
  "recommendedRoleTypes": ["3 role types with stronger evidence-based alignment"]
}`;

      const raw = await callAI(prompt, 1400, "rejection");
      const parsed = safeParseJSON<RejectionAnalysisData>(raw);
      if (!parsed) throw new Error("Analysis returned an unreadable response. Please retry.");
      setAnalysis(parsed);
    } catch (err: any) {
      setAnalysisError(err.message || "Analysis failed. Please retry.");
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Rejection Analysis</h1>
          <p className="text-xs text-muted-foreground">
            {rows.length} rejected role{rows.length === 1 ? "" : "s"} in the last {days} days · {reviewEvents.length} email
            {reviewEvents.length === 1 ? "" : "s"} to review <AIQuotaBadge feature="rejection" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (gmailConnected ? sync(Math.max(days, 30)) : connectGmail())}
            disabled={syncing}
            className="apple-card px-3.5 py-2.5 text-xs font-semibold disabled:opacity-50 hover:bg-muted/40 transition-colors"
          >
            {syncing ? "Syncing…" : gmailConnected ? "Sync Gmail" : "Connect Gmail"}
          </button>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="bg-foreground text-background rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze Rejections"}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                days === r.days ? "bg-foreground text-background" : "apple-card hover:bg-muted/40"
              }`}
            >
              Last {r.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">Last Gmail sync: {fmtTime(lastSyncedAt)}</div>
      </div>

      {/* Sync states */}
      {syncState === "not_connected" && (
        <div className="apple-card p-4 mb-4 text-sm flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Gmail isn't connected — connect it to detect rejection emails automatically.</span>
          <button onClick={connectGmail} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold">
            Connect Gmail
          </button>
        </div>
      )}
      {(syncState === "error" || syncState === "token_expired") && syncError && (
        <div
          className="rounded-xl p-4 mb-4 text-sm flex items-center justify-between gap-3"
          style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))", color: "hsl(var(--danger))" }}
        >
          <span>Gmail sync failed: {syncError}</span>
          <button onClick={() => (syncState === "token_expired" ? connectGmail() : sync(Math.max(days, 30)))} className="underline font-semibold shrink-0">
            {syncState === "token_expired" ? "Reconnect" : "Retry"}
          </button>
        </div>
      )}

      {/* Needs review */}
      {reviewEvents.length > 0 && (
        <div className="apple-card p-5 mb-4">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">
            Review unmatched rejection emails ({reviewEvents.length})
          </div>
          <div className="flex flex-col gap-3">
            {reviewEvents.map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="text-sm font-semibold">
                    {e.company} — {e.role_title}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {Math.round(Number(e.confidence) * 100)}% confidence
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  {fmt(e.received_at)} · {e.email_subject}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground italic mb-3">“{e.evidence_snippet}”</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    defaultValue=""
                    onChange={(ev) => ev.target.value && confirmMatch(e.id, ev.target.value)}
                    className="text-xs rounded-lg border border-border bg-background px-2.5 py-1.5"
                  >
                    <option value="">Match to application…</option>
                    {apps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.company} — {a.title}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => dismissEvent(e.id)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40">
                    Not a rejection
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected roles */}
      {rows.length === 0 ? (
        <div className="apple-card p-14 text-center mb-4">
          <div className="text-lg font-semibold text-muted-foreground/70 mb-2">No rejection emails found in the last {days} days</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {gmailConnected
              ? "Sync Gmail or widen the date range. Rejections you track manually will also appear here."
              : "Connect Gmail so rejection emails are detected, matched to your applications, and analyzed."}
          </p>
        </div>
      ) : (
        <div className="apple-card p-5 mb-4">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Rejected roles</div>
          <div className="flex flex-col gap-2.5">
            {rows.map(({ event, app, job }, i) => {
              const ats = job?.analysis?.score ?? job?.analysis?.atsScore;
              return (
                <div key={event?.id || app?.id || i} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{app?.title || event?.role_title}</div>
                      <div className="text-xs text-muted-foreground">{app?.company || event?.company}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-muted-foreground">{fmt(event?.received_at || app?.applied_date)}</div>
                      {ats != null && <div className="text-[11px] text-muted-foreground">ATS {ats}</div>}
                    </div>
                  </div>
                  {event?.evidence_snippet && (
                    <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground italic border-l-2 border-border pl-3">
                      “{event.evidence_snippet}”
                    </p>
                  )}
                  {event?.explicit_reason && (
                    <p className="mt-2 text-xs text-foreground">
                      <span className="font-semibold">Stated in email:</span> {event.explicit_reason}
                    </p>
                  )}
                  {!event && <p className="mt-2 text-[11px] text-muted-foreground">Tracked manually — no matched rejection email.</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {analyzing && (
        <div className="text-center py-16 apple-card mb-4">
          <Spinner size={20} />
          <p className="animate-pulse-dot text-xs text-muted-foreground mt-4">Comparing your resume against these job descriptions…</p>
        </div>
      )}

      {analysisError && !analyzing && (
        <div
          className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))", color: "hsl(var(--danger))" }}
        >
          {analysisError}
        </div>
      )}

      {analysis && !analyzing && (
        <div className="animate-fade-up flex flex-col gap-3">
          <div className="rounded-xl p-5" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-warning">Likely pattern</div>
            <p className="text-base font-semibold leading-snug">{analysis.likelyPattern}</p>
            <p className="text-[11px] mt-2 text-muted-foreground">
              Based on available evidence only — exact rejection reasons are rarely stated by employers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Patterns across applications</div>
              {analysis.patterns?.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2.5 text-sm leading-relaxed">
                  <span className="font-semibold shrink-0 text-muted-foreground">{i + 1}.</span>
                  {p}
                </div>
              ))}
            </div>
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Repeated missing skills</div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.repeatedMissingSkills?.map((s, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {analysis.resumeToJobGaps && analysis.resumeToJobGaps.length > 0 && (
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Resume-to-job gaps</div>
              <div className="flex flex-col gap-3">
                {analysis.resumeToJobGaps.map((g, i) => (
                  <div key={i}>
                    <div className="text-xs font-semibold mb-1">
                      {g.company} — {g.role}
                    </div>
                    {g.gaps?.map((x, k) => (
                      <div key={k} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                        <span>·</span>
                        {x}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Role level signal</div>
              <p className="text-sm leading-relaxed">{analysis.levelObservation}</p>
            </div>
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Industry &amp; company signal</div>
              <p className="text-sm leading-relaxed">{analysis.industryObservation}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Practical improvements</div>
              {analysis.practicalImprovements?.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2.5 text-sm leading-relaxed">
                  <span className="text-muted-foreground">→</span>
                  {f}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-5" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-success">Recommended role types</div>
              {analysis.recommendedRoleTypes?.map((r, i) => (
                <div key={i} className="text-sm leading-relaxed mb-2">
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Privacy */}
      <div className="apple-card p-5 mt-6">
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Privacy controls</div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Gmail is accessed read-only. Only rejection-related subject, sender, date and a short evidence snippet are stored — never full email
          bodies or attachments.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => confirm("Delete all synced rejection email data?") && deleteAllSyncedEmails()}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40"
          >
            Delete synced email data
          </button>
          <button
            onClick={() => confirm("Disconnect Gmail and delete all synced rejection email data?") && disconnectGmail()}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40"
          >
            Disconnect Gmail
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectionAnalysis;
