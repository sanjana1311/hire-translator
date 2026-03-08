import { useState, useEffect, useRef } from "react";
import { callAI } from "@/lib/ai";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
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
  const [results, setResults] = useState<Record<number, AnalysisResult>>({});
  const [resumes, setResumes] = useState<Record<number, string>>({});
  const [aLoading, setAL] = useState<Set<number>>(new Set());
  const [rLoading, setRL] = useState<Set<number>>(new Set());
  const [doneCount, setDone] = useState(0);
  const [selected, setSelected] = useState<Job | null>(null);
  const [jobTab, setJobTab] = useState("all");
  const [rtab, setRtab] = useState("tailored");
  const [copied, setCopied] = useState(false);
  const didRun = useRef(false);
  const { data: profile } = useProfile();
  const { importJobs, loading: gmailLoading, jobs: gmailJobs, unseenCount, lastSyncedAt, markSeen } = useGmailImport(profile?.id ?? null);
  const [showGmailJobs, setShowGmailJobs] = useState(false);

  const jobs = INITIAL_JOBS;

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    jobs.forEach((job, i) => setTimeout(() => analyzeJob(job), i * 300));
  }, []);

  const analyzeJob = async (job: Job) => {
    setAL(prev => new Set([...prev, job.id]));
    try {
      const raw = await callAI(`ATS resume expert. Return ONLY valid JSON.
RESUME: ${RESUME_TEXT}
JOB: ${job.title} at ${job.company}
${job.description}
Return: {"score":0,"bucket":"must","matchSummary":"","strengths":["","",""],"gaps":["","",""],"missingKeywords":["","","","",""]}
bucket: must>=75, tweak 40-74, low<40`, 600);
      const parsed = JSON.parse(raw);
      setResults(prev => ({ ...prev, [job.id]: parsed }));
      setDone(prev => prev + 1);
      setAL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
      setRL(prev => new Set([...prev, job.id]));
      const resumeText = await callAI(`Expert ATS resume writer. Rewrite for this specific job. Keep all real facts. Plain text only, no markdown.
ORIGINAL: ${RESUME_TEXT}
TARGET: ${job.title} at ${job.company}
JD: ${job.description}
WEAVE IN: ${parsed.missingKeywords?.join(", ")}
Output complete rewritten resume:`, 4000);
      setResumes(prev => ({ ...prev, [job.id]: resumeText }));
    } catch {
      setResults(prev => ({ ...prev, [job.id]: { error: true, score: 0, bucket: "low", matchSummary: "Analysis failed.", strengths: [], gaps: [], missingKeywords: [] } }));
      setDone(prev => prev + 1);
      setAL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
    }
    setRL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const buckets = {
    must: jobs.filter(j => results[j.id]?.bucket === "must"),
    tweak: jobs.filter(j => results[j.id]?.bucket === "tweak"),
    low: jobs.filter(j => results[j.id]?.bucket === "low"),
    pending: jobs.filter(j => !results[j.id]),
  };

  const isRunning = aLoading.size > 0 || rLoading.size > 0;
  const pct = Math.round((doneCount / jobs.length) * 100);
  const visibleJobs = jobTab === "all" ? jobs : jobTab === "pending" ? buckets.pending : (buckets[jobTab as keyof typeof buckets] || []);

  if (selected) {
    const r = results[selected.id];
    const bm = r ? BUCKET_META[r.bucket] : null;
    return (
      <div className="max-w-[1160px] mx-auto p-7 animate-fade-up">
        <button onClick={() => setSelected(null)} className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors">
          ← All roles
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left: Score card */}
          <div className="flex flex-col gap-3">
            <div className="bg-card border border-border rounded-[11px] p-5">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-background text-[11px] font-bold">{initials(selected.company)}</span>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{selected.company}</div>
                  <h2 className="font-serif text-[19px] leading-tight mb-1">{selected.title}</h2>
                  <div className="text-xs text-muted-foreground">{selected.location}{selected.salary ? ` · ${selected.salary}/yr` : ""}</div>
                </div>
              </div>
              <div className="mt-3.5 pt-3.5 border-t border-border flex gap-2.5 flex-wrap">
                <a href={selected.url} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline">View on LinkedIn ↗</a>
              </div>
            </div>

            {aLoading.has(selected.id) || !r ? (
              <div className="bg-card border border-border rounded-[11px] p-10 text-center">
                <Spinner size={18} />
                <div className="animate-pulse-dot text-xs text-muted-foreground mt-2.5">Analyzing…</div>
              </div>
            ) : (
              <div className="animate-fade-up flex flex-col gap-2.5">
                {/* Score */}
                <div className="rounded-[11px] p-5 flex items-center gap-4" style={{ background: scoreBg(r.score), border: `1px solid ${scoreBorder(r.score)}` }}>
                  <div className="shrink-0">
                    <div className="font-serif text-5xl leading-none" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">ATS match</div>
                  </div>
                  <div className="border-l pl-4 flex-1" style={{ borderColor: scoreBorder(r.score) }}>
                    {bm && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 mb-1.5 text-[11px] font-semibold" style={{ background: bm.bg, border: `1px solid ${bm.border}`, color: bm.text }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: bm.dot }} /> {bm.label}
                      </span>
                    )}
                    <p className="text-xs leading-relaxed text-secondary-foreground">{r.matchSummary}</p>
                  </div>
                </div>
                {/* Strengths / Gaps */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[9px] p-3.5" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(153 40% 30%)" }}>Strengths</div>
                    {r.strengths?.map((s, i) => (
                      <div key={i} className="flex gap-1.5 mb-1.5 text-xs leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "hsl(153 40% 30%)" }}>✓</span>{s}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[9px] p-3.5" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(348 46% 28%)" }}>Gaps</div>
                    {r.gaps?.map((g, i) => (
                      <div key={i} className="flex gap-1.5 mb-1.5 text-xs leading-relaxed" style={{ color: "hsl(348 30% 30%)" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "hsl(348 46% 28%)" }}>→</span>{g}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Missing keywords */}
                <div className="bg-card border border-border rounded-[9px] p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-secondary-foreground mb-2">Missing ATS Keywords</div>
                  <div className="flex flex-wrap gap-1">{r.missingKeywords?.map(kw => <Tag key={kw}>{kw}</Tag>)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Resume panel */}
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
                resumes[selected.id] ? (
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

      {/* Gmail imported jobs */}
      {/* Persisted imported jobs */}
      {gmailJobs.length > 0 && (showGmailJobs || unseenCount > 0) && (
        <div className="mb-5 bg-card border border-border rounded-[11px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {unseenCount > 0 && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              <h3 className="text-sm font-semibold">Imported from Gmail</h3>
              <span className="text-[11px] text-muted-foreground">
                ({unseenCount > 0 ? `${unseenCount} new` : `${gmailJobs.length} total`})
              </span>
              {lastSyncedAt && (
                <span className="text-[10px] text-muted-foreground">
                  · Last sync: {new Date(lastSyncedAt).toLocaleDateString()}
                </span>
              )}
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
                  {gj.snippet && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{gj.snippet}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{gj.source}</span>
                  {!gj.seen && (
                    <button onClick={() => markSeen(gj.id)} className="text-[10px] text-muted-foreground hover:text-foreground">✓</button>
                  )}
                  {gj.url && (
                    <a href={gj.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Apply ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-0.5 border-b border-border mb-4">
        {[
          ["all", `All (${jobs.length})`],
          ["must", `Must Apply (${buckets.must.length})`],
          ["tweak", `Needs Tweaking (${buckets.tweak.length})`],
          ["low", `Low (${buckets.low.length})`],
          ["pending", `Pending (${buckets.pending.length})`],
        ].map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => setJobTab(k)}
            className={`text-[12.5px] px-3 py-1.5 -mb-px transition-colors ${
              jobTab === k
                ? "text-foreground font-semibold border-b-2 border-foreground"
                : "text-muted-foreground border-b-2 border-transparent"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Job cards */}
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
                  <span className="text-[11px] text-muted-foreground">Queued…</span>
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
