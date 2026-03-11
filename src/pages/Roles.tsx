import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { useProfile } from "@/hooks/use-profile";
import { useResume } from "@/hooks/use-resume";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BUCKET_META,
  initials, scoreColor, scoreBg, scoreBorder,
} from "@/data/seed";
import { classifyRole, getRoleFamilyLabel, ROLE_FAMILIES, type RoleFamilyKey } from "@/lib/role-classifier";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";

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

export interface ImportedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  source: string | null;
  snippet: string | null;
  description: string | null;
  status: string;
  analysis: AnalysisResult | null;
  tailored_resume: string | null;
  imported_at: string;
  seen: boolean;
}

const Roles = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ImportedJob[]>([]);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});
  const [resumes, setResumes] = useState<Record<string, string>>({});
  const [aLoading, setAL] = useState<Set<string>>(new Set());
  const [rLoading, setRL] = useState<Set<string>>(new Set());
  const [doneCount, setDone] = useState(0);
  const [selected, setSelected] = useState<ImportedJob | null>(null);
  
  const [rtab, setRtab] = useState("tailored");
  const [copied, setCopied] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const didAutoScore = useRef(false);
  const { data: profile } = useProfile();
  const { data: resumeData } = useResume();
  const { triggerSync, connectGmail, signOut, loading: gmailLoading, lastSyncedAt, jobsImportedCount, syncStatus, syncLog } = useGmailImport(profile?.id ?? null);
  const [showSyncLog, setShowSyncLog] = useState(false);

  // Get resume text - prefer DB resume, fallback to seed
  const resumeText = resumeData?.raw_text || RESUME_TEXT;

  // Load jobs from imported_jobs table
  const loadJobsFromDB = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from("imported_jobs")
      .select("*")
      .eq("profile_id", profile.id)
      .order("imported_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading imported jobs:", error);
      return;
    }

    if (data && data.length > 0) {
      const mapped: ImportedJob[] = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        company: d.company,
        location: d.location,
        salary: d.salary,
        url: d.url,
        source: d.source,
        snippet: d.snippet,
        description: d.description,
        status: d.status,
        analysis: d.analysis as AnalysisResult | null,
        tailored_resume: d.tailored_resume,
        imported_at: d.imported_at,
        seen: d.seen,
      }));
      setJobs(mapped);

      // Hydrate results/resumes from stored analysis
      const loadedResults: Record<string, AnalysisResult> = {};
      const loadedResumes: Record<string, string> = {};
      let scored = 0;
      for (const job of mapped) {
        if (job.analysis && !job.analysis.error) {
          loadedResults[job.id] = job.analysis;
          scored++;
        }
        if (job.tailored_resume) {
          loadedResumes[job.id] = job.tailored_resume;
        }
      }
      setResults(prev => ({ ...prev, ...loadedResults }));
      setResumes(prev => ({ ...prev, ...loadedResumes }));
      setDone(scored);
    }

    // Load applied jobs
    const { data: apps } = await supabase
      .from("applications")
      .select("imported_job_id")
      .eq("profile_id", profile.id);
    if (apps) {
      setAppliedJobs(new Set(apps.map(d => d.imported_job_id).filter(Boolean) as string[]));
    }

    setDbLoaded(true);
    setInitialLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadJobsFromDB();
  }, [loadJobsFromDB]);

  // After sync completes, reload jobs
  useEffect(() => {
    if (syncStatus === "success" && profile?.id) {
      loadJobsFromDB();
    }
  }, [syncStatus, profile?.id, loadJobsFromDB]);

  // Auto-score unscored jobs after DB load
  useEffect(() => {
    if (!dbLoaded || didAutoScore.current || jobs.length === 0) return;
    didAutoScore.current = true;
    const unscored = jobs.filter(j => j.status === "new" && !results[j.id]);
    if (unscored.length === 0) return;
    console.log(`[Roles] Auto-scoring ${unscored.length} new jobs`);
    unscored.forEach((job, i) => setTimeout(() => analyzeJob(job), i * 400));
  }, [dbLoaded, jobs]);

  const analyzeJob = async (job: ImportedJob) => {
    setAL(prev => new Set([...prev, job.id]));
    let scoreResult: AnalysisResult | null = null;

    const jobDesc = job.description || job.snippet || `${job.title} at ${job.company}`;

    try {
      const raw = await callAI(`ATS resume expert. Return ONLY valid JSON.
RESUME: ${resumeText}
JOB: ${job.title} at ${job.company}
${jobDesc}
Return: {"score":0,"bucket":"must","matchSummary":"","strengths":["","",""],"gaps":["","",""],"missingKeywords":["","","","",""]}
bucket: must>=75, tweak 40-74, low<40`, 600);
      console.log('Raw scoring response:', raw);
      try {
        const parsed = JSON.parse(raw);
        scoreResult = parsed;
        setResults(prev => ({ ...prev, [job.id]: parsed }));
        // Save analysis to imported_jobs
        await supabase
          .from("imported_jobs")
          .update({ analysis: parsed as any, status: "scored" })
          .eq("id", job.id);
      } catch (e) {
        console.error('Scoring parse failed:', e, 'Raw was:', raw);
        const errResult: AnalysisResult = { error: true, score: 0, bucket: "low", matchSummary: `Scoring returned unparseable response. Raw: ${raw.slice(0, 200)}`, strengths: [], gaps: [], missingKeywords: [] };
        setResults(prev => ({ ...prev, [job.id]: errResult }));
        await supabase
          .from("imported_jobs")
          .update({ analysis: errResult as any, status: "error" })
          .eq("id", job.id);
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
      const tailoredResume = await callAI(`Expert ATS resume writer. Rewrite for this specific job. Keep all real facts. Plain text only, no markdown.
ORIGINAL: ${resumeText}
TARGET: ${job.title} at ${job.company}
JD: ${jobDesc}
WEAVE IN: ${scoreResult.missingKeywords?.join(", ")}
Output complete rewritten resume:`, 4000);
      setResumes(prev => ({ ...prev, [job.id]: tailoredResume }));
      // Save tailored resume to DB
      await supabase
        .from("imported_jobs")
        .update({ tailored_resume: tailoredResume })
        .eq("id", job.id);
    } catch (e: any) {
      console.error('Resume rewrite failed:', e);
    }
    setRL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
  };

  const handleMarkApplied = async (job: ImportedJob) => {
    if (!profile?.id || appliedJobs.has(job.id)) return;
    setApplyLoading(true);
    try {
      const { error } = await supabase.from("applications").insert({
        profile_id: profile.id,
        imported_job_id: job.id,
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

  // Filters
  const [filterFamily, setFilterFamily] = useState<RoleFamilyKey | "all">("all");
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  const toggleFamily = (key: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Classify all jobs
  const classifiedJobs = useMemo(() =>
    jobs.map(job => ({ ...job, roleFamily: classifyRole(job.title) })),
    [jobs]
  );

  // Unique values for filter dropdowns
  const uniqueCompanies = useMemo(() =>
    [...new Set(jobs.map(j => j.company))].sort(),
    [jobs]
  );
  const uniqueLocations = useMemo(() =>
    [...new Set(jobs.map(j => j.location || "Remote"))].sort(),
    [jobs]
  );

  // Apply filters
  const filteredJobs = useMemo(() => {
    return classifiedJobs.filter(job => {
      if (filterFamily !== "all" && job.roleFamily !== filterFamily) return false;
      if (filterBucket !== "all") {
        const r = results[job.id];
        if (!r || r.bucket !== filterBucket) return false;
      }
      if (filterCompany !== "all" && job.company !== filterCompany) return false;
      if (filterLocation !== "all" && (job.location || "Remote") !== filterLocation) return false;
      return true;
    });
  }, [classifiedJobs, filterFamily, filterBucket, filterCompany, filterLocation, results]);

  // Group by role family, then by bucket
  const groupedData = useMemo(() => {
    const familyMap: Record<string, typeof filteredJobs> = {};
    for (const job of filteredJobs) {
      const key = job.roleFamily;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(job);
    }

    // Sort families: defined order first, "other" last
    const familyOrder = [...ROLE_FAMILIES.map(f => f.key), "other"];
    const sortedFamilies = Object.keys(familyMap).sort(
      (a, b) => familyOrder.indexOf(a) - familyOrder.indexOf(b)
    );

    return sortedFamilies.map(familyKey => {
      const familyJobs = familyMap[familyKey];
      const bucketGroups = {
        must: familyJobs.filter(j => results[j.id]?.bucket === "must"),
        tweak: familyJobs.filter(j => results[j.id]?.bucket === "tweak"),
        low: familyJobs.filter(j => results[j.id]?.bucket === "low"),
        unscored: familyJobs.filter(j => !results[j.id]),
      };
      return { familyKey: familyKey as RoleFamilyKey, label: getRoleFamilyLabel(familyKey as RoleFamilyKey), jobs: familyJobs, bucketGroups };
    });
  }, [filteredJobs, results]);

  const buckets = {
    must: jobs.filter(j => results[j.id]?.bucket === "must"),
    tweak: jobs.filter(j => results[j.id]?.bucket === "tweak"),
    low: jobs.filter(j => results[j.id]?.bucket === "low"),
  };

  const activeFilterCount = [filterFamily, filterBucket, filterCompany, filterLocation].filter(v => v !== "all").length;

  const clearFilters = () => {
    setFilterFamily("all");
    setFilterBucket("all");
    setFilterCompany("all");
    setFilterLocation("all");
  };

  const analysisInProgress = aLoading.size > 0;
  const isRunning = aLoading.size > 0 || rLoading.size > 0;
  const pct = jobs.length > 0 ? Math.round((doneCount / jobs.length) * 100) : 0;

  // Loading state
  if (initialLoading) {
    return (
      <div className="max-w-[960px] mx-auto p-7 pt-9 text-center py-20">
        <Spinner size={24} />
        <p className="text-sm text-muted-foreground mt-3">Loading your roles…</p>
      </div>
    );
  }

  // Job detail view
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
                    {selected.company} · {selected.location || "Remote"}{selected.salary ? ` · ${selected.salary}/yr` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-border flex gap-2 flex-wrap">
                {selected.url && (
                  <button onClick={() => window.open(selected.url!, '_blank', 'noopener,noreferrer')} className="text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0">View Job ↗</button>
                )}
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
                <pre className="font-sans text-[11.5px] leading-[1.85] whitespace-pre-wrap break-words text-secondary-foreground">{resumeText}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (jobs.length === 0 && !isRunning) {
    return (
      <div className="max-w-[960px] mx-auto p-7 pt-9">
        <h1 className="font-serif text-[26px] font-normal mb-1">Today's Roles</h1>
        <p className="text-xs text-muted-foreground mb-8">Import jobs from your Gmail to get started with ATS scoring and resume tailoring.</p>

        {/* Gmail Sync Status Bar */}
        <div className="mb-6 bg-card border border-border rounded-[9px] px-4 py-3 flex items-center justify-between">
          {syncStatus === "syncing" ? (
            <>
              <div className="flex items-center gap-2">
                <Spinner size={12} />
                <span className="text-xs text-muted-foreground animate-pulse">Syncing your Gmail job alerts…</span>
              </div>
            </>
          ) : syncStatus === "success" ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[hsl(153_50%_35%)]" />
                <span className="text-xs text-muted-foreground">
                  Synced · {jobsImportedCount} jobs imported
                </span>
              </div>
              <button
                onClick={() => triggerSync(false)}
                disabled={gmailLoading}
                className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Refresh ↻
              </button>
            </>
          ) : syncStatus === "no_token" ? (
            <>
              <div className="flex items-center gap-2 flex-1 mr-3">
                <div className="w-2 h-2 rounded-full bg-[hsl(25_84%_50%)]" />
                <span className="text-xs text-muted-foreground">
                  Gmail access not granted. Sign out and sign back in — check the Gmail permission.
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={connectGmail} className="text-xs font-medium px-3 py-1 rounded-[6px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  Reconnect Gmail
                </button>
                <button onClick={signOut} className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">Connect Gmail to import your job alerts</span>
              </div>
              <button
                onClick={connectGmail}
                className="text-xs font-medium px-3 py-1 rounded-[6px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Connect Gmail →
              </button>
            </>
          )}
        </div>

        <div className="bg-card border border-dashed border-border rounded-[11px] p-12 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h3 className="font-serif text-lg mb-2">No roles imported yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Connect your Gmail to automatically pull in job alerts from LinkedIn, Indeed, Monster and more. Each job gets ATS-scored against your resume and a tailored version is generated.
          </p>
          <button
            onClick={connectGmail}
            className="text-sm font-medium px-5 py-2.5 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sync Gmail →
          </button>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="max-w-[960px] mx-auto p-7 pt-9">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-serif text-[26px] font-normal mb-1">Today's Roles</h1>
          <p className="text-xs text-muted-foreground mb-5">
            {isRunning ? `Analyzing ${jobs.length} roles…` : `${jobs.length} roles ready · click to review your tailored resume`}
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

      {/* Gmail Sync Status Bar */}
      <div className="mb-4 bg-card border border-border rounded-[9px] px-4 py-3 flex items-center justify-between">
        {syncStatus === "never_synced" || syncStatus === "idle" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Connect Gmail to import more job alerts</span>
            </div>
            <button
              onClick={connectGmail}
              className="text-xs font-medium px-3 py-1 rounded-[6px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Connect Gmail →
            </button>
          </>
        ) : syncStatus === "syncing" ? (
          <>
            <div className="flex items-center gap-2">
              <Spinner size={12} />
              <span className="text-xs text-muted-foreground animate-pulse">Syncing your Gmail job alerts…</span>
            </div>
          </>
        ) : syncStatus === "success" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[hsl(153_50%_35%)]" />
              <span className="text-xs text-muted-foreground">
                Last synced {lastSyncedAt ? (() => {
                  const diff = Date.now() - new Date(lastSyncedAt).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 2) return "just now";
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })() : "never"} · {jobsImportedCount} jobs imported
              </span>
            </div>
            <button
              onClick={() => triggerSync(false)}
              disabled={gmailLoading}
              className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              Refresh ↻
            </button>
          </>
        ) : syncStatus === "error" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs text-destructive">Sync failed — tap to retry</span>
            </div>
            <button
              onClick={() => triggerSync(false)}
              disabled={gmailLoading}
              className="text-xs font-medium px-3 py-1 rounded-[6px] border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              Retry
            </button>
          </>
        ) : syncStatus === "no_token" ? (
          <>
            <div className="flex items-center gap-2 flex-1 mr-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(25_84%_50%)]" />
              <span className="text-xs text-muted-foreground">
                Gmail access not granted. Sign out and sign back in — make sure to check the Gmail permission on the Google screen.
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={connectGmail}
                className="text-xs font-medium px-3 py-1 rounded-[6px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Reconnect Gmail
              </button>
              <button
                onClick={signOut}
                className="text-xs font-medium px-3 py-1 rounded-[6px] border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[6px] border transition-colors ${
              activeFilterCount > 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto flex gap-1">
            {([["must", "hsl(153 40% 30%)", buckets.must.length], ["tweak", "hsl(25 84% 31%)", buckets.tweak.length], ["low", "hsl(348 46% 28%)", buckets.low.length]] as const).map(([k, c, n]) => (
              <div key={k} className="flex items-center gap-1 bg-secondary border border-border rounded-full px-2.5 py-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                <span className="text-[11px] text-secondary-foreground font-medium">{n as number}</span>
              </div>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-card border border-border rounded-[9px] p-3 animate-fade-up">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Role Family</label>
              <select
                value={filterFamily}
                onChange={e => setFilterFamily(e.target.value as any)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Families</option>
                {ROLE_FAMILIES.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Score Bucket</label>
              <select
                value={filterBucket}
                onChange={e => setFilterBucket(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Buckets</option>
                <option value="must">Must Apply</option>
                <option value="tweak">Needs Tweaking</option>
                <option value="low">Low Alignment</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Company</label>
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Companies</option>
                {uniqueCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Location</label>
              <select
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
                className="w-full text-xs bg-secondary border border-border rounded-[5px] px-2 py-1.5 text-foreground"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Grouped job list */}
      {filteredJobs.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[11px] p-10 text-center">
          <p className="text-sm text-muted-foreground">No roles match your filters.</p>
          <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedData.map(({ familyKey, label, jobs: familyJobs, bucketGroups }) => {
            const isCollapsed = collapsedFamilies.has(familyKey);
            return (
              <div key={familyKey}>
                {/* Family header */}
                <button
                  onClick={() => toggleFamily(familyKey)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h2 className="font-serif text-[17px] font-normal">{label}</h2>
                  <span className="text-[11px] text-muted-foreground">({familyJobs.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3 ml-5">
                    {(["must", "tweak", "low", "unscored"] as const).map(bucketKey => {
                      const bucketJobs = bucketGroups[bucketKey];
                      if (bucketJobs.length === 0) return null;
                      const bm = bucketKey !== "unscored" ? BUCKET_META[bucketKey] : null;
                      return (
                        <div key={bucketKey}>
                          {/* Bucket sub-header */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {bm ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: bm.bg, border: `1px solid ${bm.border}`, color: bm.text }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: bm.dot }} />
                                {bm.label} ({bucketJobs.length})
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-medium">Scoring… ({bucketJobs.length})</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {bucketJobs.map((job, i) => {
                              const r = results[job.id];
                              const jobBm = r ? BUCKET_META[r.bucket] : null;
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
                                      {job.source && <span className="text-[10px] text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5">{job.source}</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{job.company} · {job.location || "Remote"}{job.salary ? ` · ${job.salary}` : ""}</div>
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
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sync Log - hidden in production, only visible in dev/preview */}
      {syncLog.length > 0 && import.meta.env.DEV && (
        <div className="mt-6 mb-4">
          <button
            onClick={() => setShowSyncLog(!showSyncLog)}
            className="text-[11px] text-muted-foreground hover:text-foreground mb-1"
          >
            {showSyncLog ? "▾ Hide" : "▸ Show"} Sync Log ({syncLog.length} entries)
          </button>
          {showSyncLog && (
            <div className="bg-card border border-border rounded-[7px] p-3 font-mono text-[11px] text-muted-foreground max-h-[200px] overflow-y-auto">
              {syncLog.map((entry, i) => (
                <div key={i}>[{entry.time}] {entry.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Roles;
