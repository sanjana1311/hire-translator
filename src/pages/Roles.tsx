import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  INITIAL_JOBS, RESUME_TEXT, BUCKET_META,
  initials, scoreColor, scoreBg, scoreBorder,
  type Job,
} from "@/data/seed";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div
    className="border-2 border-border border-t-foreground rounded-full animate-spin"
    style={{ width: size, height: size, flexShrink: 0 }}
  />
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5 font-medium">
    {children}
  </span>
);

interface AnalysisResult {
  score: number;
  bucket: string;
  matchSummary: string;
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  error?: boolean;
}

const Roles = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<number, AnalysisResult>>({});
  const [resumes, setResumes] = useState<Record<number, string>>({});
  const [aLoading, setAL] = useState<Set<number>>(new Set());
  const [rLoading, setRL] = useState<Set<number>>(new Set());
  const [doneCount, setDone] = useState(0);
  const [selected, setSelected] = useState<Job | null>(null);
  const [jobTab, setJobTab] = useState("all");
  const [rtab, setRtab] = useState("tailored");
  const [copied, setCopied] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<number>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const didRun = useRef(false);
  const { data: profile } = useProfile();
  const { importJobs, loading: gmailLoading, jobs: gmailJobs, unseenCount, lastSyncedAt, markSeen } = useGmailImport(profile?.id ?? null);
  const [showGmailJobs, setShowGmailJobs] = useState(false);

  const jobs = INITIAL_JOBS;

  // Load persisted analyses + applied status from DB on mount
  useEffect(() => {
    if (!profile?.id) return;
    const loadFromDB = async () => {
      // Load analyses
      const { data: analyses } = await supabase
        .from("role_analyses")
        .select("*")
        .eq("profile_id", profile.id);

      if (analyses && analyses.length > 0) {
        const loadedResults: Record<number, AnalysisResult> = {};
        const loadedResumes: Record<number, string> = {};
        for (const a of analyses) {
          loadedResults[a.job_seed_id] = {
            score: a.score,
            bucket: a.bucket,
            matchSummary: a.match_summary || "",
            strengths: (a.strengths as string[]) || [],
            gaps: (a.gaps as string[]) || [],
            missingKeywords: (a.missing_keywords as string[]) || [],
            error: a.error || false,
          };
          if (a.tailored_resume) {
            loadedResumes[a.job_seed_id] = a.tailored_resume;
          }
        }
        setResults(loadedResults);
        setResumes(loadedResumes);
        setDone(Object.keys(loadedResults).length);
      }

      // Load applied jobs
      const { data: apps } = await supabase
        .from("applications")
        .select("job_seed_id")
        .eq("profile_id", profile.id);
      if (apps) {
        setAppliedJobs(new Set(apps.map(d => d.job_seed_id).filter(Boolean) as number[]));
      }

      setDbLoaded(true);
    };
    loadFromDB();
  }, [profile?.id]);

  // After DB load, run analysis for any jobs not yet scored
  useEffect(() => {
    if (!dbLoaded || !profile?.id || didRun.current) return;
    didRun.current = true;
    const unjudged = jobs.filter(j => !results[j.id] || results[j.id]?.error);
    if (unjudged.length === 0) return;
    unjudged.forEach((job, i) => setTimeout(() => analyzeJob(job), i * 300));
  }, [dbLoaded, profile?.id]);

  const saveAnalysisToDB = async (jobId: number, result: AnalysisResult, resumeText?: string) => {
    if (!profile?.id) return;
    const payload: any = {
      profile_id: profile.id,
      job_seed_id: jobId,
      score: result.score,
      bucket: result.bucket,
      match_summary: result.matchSummary,
      strengths: result.strengths,
      gaps: result.gaps,
      missing_keywords: result.missingKeywords,
      error: result.error || false,
      updated_at: new Date().toISOString(),
    };
    if (resumeText) payload.tailored_resume = resumeText;

    await supabase.from("role_analyses").upsert(payload, { onConflict: "profile_id,job_seed_id" });
  };

  const analyzeJob = async (job: Job) => {
    setAL(prev => new Set([...prev, job.id]));
    let scoreResult: AnalysisResult | null = null;
    try {
      const raw = await callAI(`ATS resume expert. Return ONLY valid JSON.
RESUME: ${RESUME_TEXT}
JOB: ${job.title} at ${job.company}
${job.description}
Return: {"score":0,"bucket":"must","matchSummary":"","strengths":["","",""],"gaps":["","",""],"missingKeywords":["","","","",""]}
bucket: must>=75, tweak 40-74, low<40`, 600);
      console.log('Raw scoring response:', raw);
      try {
        const parsed = JSON.parse(raw);
        scoreResult = parsed;
        setResults(prev => ({ ...prev, [job.id]: parsed }));
        // Save to DB
        saveAnalysisToDB(job.id, parsed);
      } catch (e) {
        console.error('Scoring parse failed:', e, 'Raw was:', raw);
        const errResult: AnalysisResult = { error: true, score: 0, bucket: "low", matchSummary: `Scoring returned unparseable response. Raw: ${raw.slice(0, 200)}`, strengths: [], gaps: [], missingKeywords: [] };
        setResults(prev => ({ ...prev, [job.id]: errResult }));
      }
    } catch (e: any) {
      console.error('Scoring call failed:', e);
      const errResult: AnalysisResult = { error: true, score: 0, bucket: "low", matchSummary: `AI call failed: ${e?.message || 'Unknown error'}`, strengths: [], gaps: [], missingKeywords: [] };
      setResults(prev => ({ ...prev, [job.id]: errResult }));
    }
    setDone(prev => prev + 1);
    setAL(prev => { const s = new Set(prev); s.delete(job.id); return s; });

    if (!scoreResult || scoreResult.error) return;

    setRL(prev => new Set([...prev, job.id]));
    try {
      const resumeText = await callAI(`Expert ATS resume writer. Rewrite for this specific job. Keep all real facts. Plain text only, no markdown.
ORIGINAL: ${RESUME_TEXT}
TARGET: ${job.title} at ${job.company}
JD: ${job.description}
WEAVE IN: ${scoreResult.missingKeywords?.join(", ")}
Output complete rewritten resume:`, 4000);
      setResumes(prev => ({ ...prev, [job.id]: resumeText }));
      // Save resume to DB
      saveAnalysisToDB(job.id, scoreResult, resumeText);
    } catch (e: any) {
      console.error('Resume rewrite failed:', e);
    }
    setRL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
  };

  const handleMarkApplied = async (job: Job) => {
    if (!profile?.id || appliedJobs.has(job.id)) return;
    setApplyLoading(true);
    try {
      const { error } = await supabase.from("applications").insert({
        profile_id: profile.id,
        job_seed_id: job.id,
        title: job.title,
        company: job.company,
        status: "applied",
      });
      if (error) throw error;
      setAppliedJobs(prev => new Set([...prev, job.id]));
      toast.success("Added to Applications tracker");
    } catch (e: any) {
      toast.error(e.message || "Failed to mark as applied");
    } finally {
      setApplyLoading(false);
    }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const buckets = {
    must: jobs.filter(j => results[j.id]?.bucket === "must"),
    tweak: jobs.filter(j => results[j.id]?.bucket === "tweak"),
    low: jobs.filter(j => results[j.id]?.bucket === "low"),
  };

  const analysisInProgress = aLoading.size > 0;
  const isRunning = aLoading.size > 0 || rLoading.size > 0;
  const pct = Math.round((doneCount / jobs.length) * 100);
  const visibleJobs = jobTab === "all" ? jobs : (buckets[jobTab as keyof typeof buckets] || []);

  if (selected) {
    const r = results[selected.id];
    const bm = r ? BUCKET_META[r.bucket] : null;
    const hasError = r?.error;
    const isApplied = appliedJobs.has(selected.id);
    return (
      <div className="max-w-[1200px] mx-auto p-7 animate-fade-up">
        <button onClick={() => setSelected(null)} className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors">
          ← All roles
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-3">
            <div className="bg-card border border-border rounded-[11px] p-5">
              <div className="flex gap-3.5 items-start">
                <div className="w-12 h-12 bg-foreground rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-background text-xs font-bold">{initials(selected.company)}</span>
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[22px] leading-tight mb-1">{selected.title}</h2>
                  <div className="text-xs text-muted-foreground">
                    {selected.company} · {selected.location}{selected.salary ? ` · ${selected.salary}/yr` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-border flex gap-2 flex-wrap">
                <button onClick={() => window.open(selected.url, '_blank', 'noopener,noreferrer')} className="text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0">View on LinkedIn ↗</button>
                {isApplied ? (
                  <span className="text-xs font-medium px-3 py-1 rounded-[6px] border" style={{ background: "hsl(150 38% 96%)", borderColor: "hsl(152 34% 82%)", color: "hsl(153 40% 30%)" }}>
                    Applied ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handleMarkApplied(selected)}
                    disabled={applyLoading}
                    className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {applyLoading ? "Saving…" : "Mark as Applied"}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/dashboard/networking?jobId=${selected.id}`)}
                  className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                >
                  Get Connections
                </button>
                <button
                  onClick={() => navigate(`/dashboard/prep?jobId=${selected.id}`)}
                  className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                >
                  Interview Prep
                </button>
              </div>
            </div>

            {aLoading.has(selected.id) || !r ? (
              <div className="bg-card border border-border rounded-[11px] p-10 text-center">
                <Spinner size={18} />
                <div className="animate-pulse-dot text-xs text-muted-foreground mt-2.5">Analyzing…</div>
              </div>
            ) : hasError ? (
              <div className="animate-fade-up bg-card border border-destructive/30 rounded-[11px] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-destructive text-sm font-semibold">⚠ Scoring Failed</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{r.matchSummary}</p>
                <button
                  onClick={() => {
                    setResults(prev => { const n = { ...prev }; delete n[selected.id]; return n; });
                    setDone(prev => prev - 1);
                    analyzeJob(selected);
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                >
                  Retry Analysis
                </button>
              </div>
            ) : (
              <div className="animate-fade-up flex flex-col gap-2.5">
                <div className="rounded-[11px] p-5 flex items-center gap-5" style={{ background: scoreBg(r.score), border: `1px solid ${scoreBorder(r.score)}` }}>
                  <div className="shrink-0 text-center">
                    <div className="font-serif text-[52px] leading-none" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">ATS Match</div>
                  </div>
                  <div className="border-l pl-5 flex-1" style={{ borderColor: scoreBorder(r.score) }}>
                    {bm && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 mb-2 text-[11px] font-semibold" style={{ background: bm.bg, border: `1px solid ${bm.border}`, color: bm.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: bm.dot }} /> {bm.label}
                      </span>
                    )}
                    <p className="text-xs leading-relaxed text-secondary-foreground">{r.matchSummary}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-[10px] p-4" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "hsl(153 40% 30%)" }}>Strengths</div>
                    {(r.strengths?.length ?? 0) > 0 ? r.strengths.map((s, i) => (
                      <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>
                        <span className="shrink-0 mt-0.5 font-bold" style={{ color: "hsl(153 50% 35%)" }}>✓</span>{s}
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">No strengths identified</p>}
                  </div>
                  <div className="rounded-[10px] p-4" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "hsl(348 46% 28%)" }}>Gaps</div>
                    {(r.gaps?.length ?? 0) > 0 ? r.gaps.map((g, i) => (
                      <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed" style={{ color: "hsl(348 30% 30%)" }}>
                        <span className="shrink-0 mt-0.5 font-bold" style={{ color: "hsl(348 50% 35%)" }}>→</span>{g}
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">No gaps identified</p>}
                  </div>
                </div>

                {(r.missingKeywords?.length ?? 0) > 0 && (
                  <div className="bg-card border border-border rounded-[10px] p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-secondary-foreground mb-2.5">Missing ATS Keywords</div>
                    <div className="flex flex-wrap gap-1.5">{r.missingKeywords.map(kw => <Tag key={kw}>{kw}</Tag>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — sticky resume panel */}
          <div className="bg-card border border-border rounded-[11px] overflow-hidden sticky top-[60px]">
            <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
              <div className="flex">
                {(["tailored", "original"] as const).map((k, i) => (
                  <button
                    key={k}
                    onClick={() => setRtab(k)}
                    className={`text-xs font-medium px-3 py-1 border transition-colors ${
                      rtab === k ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border"
                    } ${i === 0 ? "rounded-l-[5px]" : "rounded-r-[5px] -ml-px"}`}
                  >
                    {k === "tailored" ? "Tailored" : "Original"}
                  </button>
                ))}
              </div>
              {resumes[selected.id] && rtab === "tailored" && (
                <button
                  onClick={() => copy(resumes[selected.id])}
                  className={`text-xs font-semibold px-3 py-1 rounded-[6px] border transition-colors ${
                    copied ? "bg-[hsl(150_38%_96%)] border-[hsl(152_34%_82%)] text-[hsl(153_40%_30%)]" : "bg-secondary border-border text-secondary-foreground"
                  }`}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              )}
            </div>
            <div className="p-5 h-[calc(100vh-180px)] overflow-y-auto">
              {rtab === "tailored" ? (
                hasError ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted-foreground">Resume tailoring unavailable — scoring must succeed first.</p>
                  </div>
                ) : resumes[selected.id] ? (
                  <pre className="font-sans text-[11.5px] leading-[1.85] whitespace-pre-wrap break-words text-secondary-foreground">{resumes[selected.id]}</pre>
                ) : (
                  <div className="text-center py-16">
                    <Spinner size={18} />
                    <p className="animate-pulse-dot font-serif italic text-sm text-muted-foreground mt-3">Writing your tailored resume…</p>
                  </div>
                )
              ) : (
                <pre className="font-sans text-[11.5px] leading-[1.85] whitespace-pre-wrap break-words text-secondary-foreground">{RESUME_TEXT}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto p-7 pt-9">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-serif text-[26px] font-normal mb-1">Today's Roles</h1>
          <p className="text-xs text-muted-foreground mb-5">
            {isRunning ? `Analyzing all ${jobs.length} roles…` : `${jobs.length} roles ready · click to review your tailored resume`}
            {lastSyncedAt && (
              <span className="ml-2 text-muted-foreground/70">
                · Last synced {(() => {
                  const diff = Date.now() - new Date(lastSyncedAt).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })()}
              </span>
            )}
          </p>
        </div>
        {isRunning ? (
          <div className="flex items-center gap-2">
            <Spinner size={13} />
            <div>
              <div className="flex justify-between mb-0.5">
                <span className="animate-pulse-dot text-[11px] text-secondary-foreground">Analyzing {doneCount}/{jobs.length}…</span>
                <span className="text-[11px] text-muted-foreground ml-2.5">{pct}%</span>
              </div>
              <div className="bg-border rounded-sm h-0.5 w-[140px]">
                <div className="bg-foreground h-0.5 rounded-sm transition-all duration-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-1">
            {([["must", "hsl(153 40% 30%)", buckets.must.length], ["tweak", "hsl(25 84% 31%)", buckets.tweak.length], ["low", "hsl(348 46% 28%)", buckets.low.length]] as const).map(([k, c, n]) => (
              <div key={k} className="flex items-center gap-1 bg-secondary border border-border rounded-full px-2.5 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                <span className="text-[11px] text-secondary-foreground font-medium">{n as number}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {gmailJobs.length > 0 && (showGmailJobs || unseenCount > 0) && (
        <div className="mb-5 bg-card border border-border rounded-[11px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {unseenCount > 0 && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              <h3 className="text-sm font-semibold">Imported from Gmail</h3>
              <span className="text-[11px] text-muted-foreground">
                ({unseenCount > 0 ? `${unseenCount} new` : `${gmailJobs.length} total`})
              </span>
            </div>
            <button onClick={() => setShowGmailJobs(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Dismiss
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {gmailJobs.filter(gj => showGmailJobs || !gj.seen).map((gj) => (
              <div key={gj.id} className={`border border-border rounded-[7px] p-3 flex items-center justify-between ${gj.seen ? 'bg-secondary/30' : 'bg-secondary/50'}`}>
                <div>
                  <div className="text-sm font-medium">{gj.title}</div>
                  <div className="text-xs text-muted-foreground">{gj.company} · {gj.location}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{gj.source}</span>
                  {!gj.seen && <button onClick={() => markSeen(gj.id)} className="text-[10px] text-muted-foreground hover:text-foreground">✓</button>}
                  {gj.url && <a href={gj.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Apply ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-0.5 border-b border-border mb-4">
        {[
          ["all", `All (${jobs.length})`],
          ["must", `Must Apply (${buckets.must.length})`],
          ["tweak", `Needs Tweaking (${buckets.tweak.length})`],
          ["low", `Low (${buckets.low.length})`],
        ].map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setJobTab(k)}
            className={`text-[12.5px] px-3 py-1.5 -mb-px transition-colors ${
              jobTab === k ? "text-foreground font-semibold border-b-2 border-foreground" : "text-muted-foreground border-b-2 border-transparent"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {visibleJobs.map((job, i) => {
          const r = results[job.id];
          const bm = r ? BUCKET_META[r.bucket] : null;
          return (
            <div
              key={job.id}
              onClick={() => setSelected(job)}
              className="animate-fade-up bg-card border border-border rounded-[9px] p-4 grid cursor-pointer hover:shadow-sm hover:-translate-y-px transition-all"
              style={{ gridTemplateColumns: "38px 1fr 100px", gap: 12, alignItems: "center", animationDelay: `${i * 0.04}s` }}
            >
              <div className="w-[38px] h-[38px] bg-secondary border border-border rounded-lg flex items-center justify-center">
                <span className="text-[10px] font-bold text-secondary-foreground">{initials(job.company)}</span>
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold">{job.title}</span>
                  {bm && (
                    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold" style={{ background: bm.bg, border: `1px solid ${bm.border}`, color: bm.text }}>
                      <span className="w-1 h-1 rounded-full inline-block" style={{ background: bm.dot }} />
                      {bm.label}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{job.company} · {job.location}{job.salary ? ` · ${job.salary}` : ""}</div>
                {r && (
                  <div className="flex flex-wrap gap-0.5 mt-1.5">
                    {r.missingKeywords?.slice(0, 4).map(kw => <Tag key={kw}>{kw}</Tag>)}
                  </div>
                )}
              </div>
              <div className="text-right">
                {aLoading.has(job.id) ? (
                  <div className="flex flex-col items-end gap-1">
                    <Spinner size={14} />
                    <span className="animate-pulse-dot text-[10px] text-muted-foreground">Scoring…</span>
                  </div>
                ) : r ? (
                  <div>
                    <div className="font-serif text-2xl leading-none" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {rLoading.has(job.id) ? <span className="animate-pulse-dot">writing…</span> : "ready"}
                    </div>
                  </div>
                ) : (
                  <Spinner size={14} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Roles;
