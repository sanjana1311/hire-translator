import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { useProfile } from "@/hooks/use-profile";
import { useResume } from "@/hooks/use-resume";
import { useAIUsage } from "@/hooks/use-ai-usage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cleanText } from "@/lib/clean-text";
import {
  BUCKET_META,
  initials, scoreColor, scoreBg, scoreBorder,
} from "@/data/seed";
import { classifyRole, getRoleFamilyLabel, ROLE_FAMILIES, type RoleFamilyKey } from "@/lib/role-classifier";
import { ChevronDown, ChevronRight, SlidersHorizontal, X, Trash2 } from "lucide-react";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div
    className="border-2 border-foreground/10 border-t-foreground/60 rounded-full animate-spin"
    style={{ width: size, height: size, flexShrink: 0 }}
  />
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] text-muted-foreground bg-secondary rounded-md px-1.5 py-0.5 font-medium">
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
  const { remaining: aiRemaining, limit: aiLimit, refresh: refreshAIUsage } = useAIUsage("roles");

  const resumeText = resumeData?.raw_text || "";

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

  useEffect(() => {
    if (syncStatus === "success" && profile?.id) {
      loadJobsFromDB();
    }
  }, [syncStatus, profile?.id, loadJobsFromDB]);

  // Scoring is manual and one-at-a-time — triggered per job row by the user.
  const handleScoreJob = async (job: ImportedJob, force = false) => {
    if (!resumeText) {
      toast.error("Upload your resume first before scoring");
      return;
    }
    if (aLoading.size > 0) {
      toast.info("Another job is being scored — wait for it to finish");
      return;
    }
    if (force) {
      setResults(prev => { const n = { ...prev }; delete n[job.id]; return n; });
      setDone(prev => Math.max(0, prev - 1));
      await supabase
        .from("imported_jobs")
        .update({ analysis: null, status: "new" } as any)
        .eq("id", job.id);
    }
    await analyzeJob(job);
  };

  const analyzeJob = async (job: ImportedJob) => {
    if (!resumeText) {
      console.warn(`[Roles] Skipping ${job.title} — no resume loaded`);
      return;
    }
    setAL(prev => new Set([...prev, job.id]));
    let scoreResult: AnalysisResult | null = null;

    const jobDesc = job.description || job.snippet || `${job.title} at ${job.company}`;

    try {
      const raw = await callAI(`You are a strict ATS resume matcher. You must analyze the SPECIFIC requirements of this job and compare them against the candidate's ACTUAL skills and experience. Think step-by-step before scoring.

STEP 1: List the top 5 hard skills/technologies this job requires.
STEP 2: For each, check if the resume explicitly mentions it.
STEP 3: Assess seniority alignment (years of experience, leadership level).
STEP 4: Calculate a score based on match percentage.

RESUME:
${resumeText}

---
JOB: ${job.title} at ${job.company}
DESCRIPTION:
${jobDesc}
---

SCORING GUIDE:
- 85-100: Resume matches 80%+ of required skills AND seniority level
- 70-84: Most skills match but missing 1-2 key requirements  
- 55-69: Partial match, several gaps in required skills/experience
- 40-54: Weak match, major skill gaps
- Below 40: Poor fit, different domain/seniority

CRITICAL: Your score MUST reflect how many of THIS job's specific requirements appear in the resume. A generic software engineer resume should NOT score 90+ for a specialized ML Engineer role.

Return ONLY this JSON (no other text):
{"score":<number>,"bucket":"<must|tweak|low>","matchSummary":"<2 sentences explaining why this specific score>","strengths":["<3 specific matches>"],"gaps":["<3 specific gaps for THIS role>"],"missingKeywords":["<5 keywords from JD not in resume>"]}

bucket: must if score>=75, tweak if 40-74, low if <40`, 800, "roles");
      console.log('Raw scoring response:', raw);
      try {
        const parsed = JSON.parse(raw);
        scoreResult = parsed;
        setResults(prev => ({ ...prev, [job.id]: parsed }));
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
  };

  const generateTailoredResume = async (job: ImportedJob) => {
    if (!resumeText) return;
    const r = results[job.id];
    if (!r || r.error) return;
    const jobDesc = job.description || job.snippet || `${job.title} at ${job.company}`;
    setRL(prev => new Set([...prev, job.id]));
    try {
      const tailoredResume = await callAI(`Expert ATS resume writer. Rewrite for this specific job. Keep all real facts. Plain text only, no markdown.
ORIGINAL: ${resumeText}
TARGET: ${job.title} at ${job.company}
JD: ${jobDesc}
WEAVE IN: ${r.missingKeywords?.join(", ")}
Output complete rewritten resume:`, 4000, "roles");
      setResumes(prev => ({ ...prev, [job.id]: tailoredResume }));
      await supabase
        .from("imported_jobs")
        .update({ tailored_resume: tailoredResume })
        .eq("id", job.id);
      refreshAIUsage();
    } catch (e: any) {
      console.error('Resume rewrite failed:', e);
      toast.error(e.message || "Failed to generate tailored resume");
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

  const handleDeleteJob = async (job: ImportedJob) => {
    if (!profile?.id) return;
    try {
      const { error } = await supabase
        .from("imported_jobs")
        .delete()
        .eq("id", job.id)
        .eq("profile_id", profile.id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== job.id));
      setResults(prev => { const n = { ...prev }; delete n[job.id]; return n; });
      setResumes(prev => { const n = { ...prev }; delete n[job.id]; return n; });
      if (selected?.id === job.id) setSelected(null);
      toast.success("Job deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete job");
    }
  };

  const handleClearAllScores = async () => {
    const jobIds = jobs.map(j => j.id);
    for (const id of jobIds) {
      await supabase
        .from("imported_jobs")
        .update({ analysis: null, status: "new" } as any)
        .eq("id", id);
    }
    setResults({});
    setDone(0);
    await loadJobsFromDB();
    toast.success("Scores cleared — score jobs individually from each row");
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

  const classifiedJobs = useMemo(() =>
    jobs.map(job => ({ ...job, roleFamily: classifyRole(job.title) })),
    [jobs]
  );

  const uniqueCompanies = useMemo(() =>
    [...new Set(jobs.map(j => j.company))].sort(),
    [jobs]
  );
  const uniqueLocations = useMemo(() =>
    [...new Set(jobs.map(j => j.location || "Remote"))].sort(),
    [jobs]
  );

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

  const groupedData = useMemo(() => {
    const familyMap: Record<string, typeof filteredJobs> = {};
    for (const job of filteredJobs) {
      const key = job.roleFamily;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(job);
    }

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
      <div className="max-w-[960px] mx-auto px-6 py-10 text-center py-20">
        <Spinner size={24} />
        <p className="text-sm text-muted-foreground mt-4">Loading your roles…</p>
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
      <div className="max-w-[1200px] mx-auto px-6 py-10 animate-fade-up">
        <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1">
          ← All roles
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-3">
            <div className="apple-card p-5">
              <div className="flex gap-3.5 items-start">
                <div className="w-11 h-11 bg-foreground rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-background text-xs font-bold">{initials(selected.company)}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold leading-tight mb-1">{cleanText(selected.title)}</h2>
                  <div className="text-xs text-muted-foreground">
                    {selected.company} · {selected.location || "Remote"}{selected.salary ? ` · ${selected.salary}/yr` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-border/60 flex gap-2 flex-wrap">
                {selected.url && (
                  <button onClick={() => window.open(selected.url!, '_blank', 'noopener,noreferrer')} className="text-xs font-medium text-accent hover:underline cursor-pointer bg-transparent border-none p-0">View Job ↗</button>
                )}
                {isApplied ? (
                  <span className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))", color: "hsl(var(--success))" }}>
                    Applied ✓
                  </span>
                ) : (
                  <button
                    onClick={() => handleMarkApplied(selected)}
                    disabled={applyLoading}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    {applyLoading ? "Saving…" : "Mark as Applied"}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/dashboard/networking?jobId=${selected.id}`)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Get Connections
                </button>
                <button
                  onClick={() => navigate(`/dashboard/prep?jobId=${selected.id}`)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Interview Prep
                </button>
                <button
                  onClick={() => handleDeleteJob(selected)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {aLoading.has(selected.id) || !r ? (
              <div className="apple-card p-12 text-center">
                <Spinner size={18} />
                <div className="animate-pulse-dot text-xs text-muted-foreground mt-3">Analyzing…</div>
              </div>
            ) : hasError ? (
              <div className="animate-fade-up apple-card border-destructive/20 p-5">
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
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Retry Analysis
                </button>
              </div>
            ) : (
              <div className="animate-fade-up flex flex-col gap-3">
                <div className="rounded-xl p-5 flex items-center gap-5" style={{ background: scoreBg(r.score), border: `1px solid ${scoreBorder(r.score)}` }}>
                  <div className="shrink-0 text-center">
                    <div className="text-5xl font-semibold leading-none tabular-nums" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5">ATS Match</div>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-3 text-success">Strengths</div>
                    {(r.strengths?.length ?? 0) > 0 ? r.strengths.map((s, i) => (
                      <div key={i} className="flex gap-1.5 mb-2.5 text-xs leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>
                        <span className="shrink-0 mt-0.5 font-bold text-success">✓</span>{s}
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">No strengths identified</p>}
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))" }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-3 text-danger">Gaps</div>
                    {(r.gaps?.length ?? 0) > 0 ? r.gaps.map((g, i) => (
                      <div key={i} className="flex gap-1.5 mb-2.5 text-xs leading-relaxed" style={{ color: "hsl(348 30% 30%)" }}>
                        <span className="shrink-0 mt-0.5 font-bold text-danger">→</span>{g}
                      </div>
                    )) : <p className="text-xs text-muted-foreground italic">No gaps identified</p>}
                  </div>
                </div>

                {(r.missingKeywords?.length ?? 0) > 0 && (
                  <div className="apple-card p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Missing ATS Keywords</div>
                    <div className="flex flex-wrap gap-1.5">{r.missingKeywords.map(kw => <Tag key={kw}>{kw}</Tag>)}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — sticky resume panel */}
          <div className="apple-card overflow-hidden sticky top-[60px]">
            <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
              <div className="flex bg-secondary/60 rounded-lg p-0.5">
                {(["tailored", "original"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setRtab(k)}
                    className={`text-xs font-medium px-3.5 py-1.5 rounded-md transition-all duration-200 ${
                      rtab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {k === "tailored" ? "Tailored" : "Original"}
                  </button>
                ))}
              </div>
              {resumes[selected.id] && rtab === "tailored" && (
                <button
                  onClick={() => copy(resumes[selected.id])}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                    copied ? "bg-[hsl(var(--success-bg))] text-success" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
                ) : rLoading.has(selected.id) ? (
                  <div className="text-center py-16">
                    <Spinner size={18} />
                    <p className="animate-pulse-dot text-sm text-muted-foreground mt-3">Writing your tailored resume…</p>
                  </div>
                ) : r ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted-foreground mb-4">Tailored resume not generated yet.</p>
                    <button
                      onClick={() => generateTailoredResume(selected)}
                      className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity"
                    >
                      Generate Tailored Resume
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted-foreground">Score the job first to generate a tailored resume.</p>
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
      <div className="max-w-[960px] mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Today's Roles</h1>
        <p className="text-xs text-muted-foreground mb-8">Import jobs from your Gmail to get started with ATS scoring and resume tailoring.</p>

        {/* Gmail Sync Status Bar */}
        <div className="mb-6 apple-card px-5 py-3.5 flex items-center justify-between">
          {syncStatus === "syncing" ? (
            <div className="flex items-center gap-2.5">
              <Spinner size={12} />
              <span className="text-xs text-muted-foreground animate-pulse">Syncing your Gmail job alerts…</span>
            </div>
          ) : syncStatus === "success" ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">Synced · {jobsImportedCount} jobs imported</span>
              </div>
              <button
                onClick={() => triggerSync(false)}
                disabled={gmailLoading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                Refresh ↻
              </button>
            </>
          ) : syncStatus === "no_token" ? (
            <>
              <div className="flex items-center gap-2.5 flex-1 mr-3">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">Gmail access not granted. Sign out and sign back in — check the Gmail permission.</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={connectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity">Reconnect Gmail</button>
                <button onClick={signOut} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Sign out</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Connect Gmail to import your job alerts</span>
              </div>
              <button onClick={connectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity">
                Connect Gmail →
              </button>
            </>
          )}
        </div>

        <div className="apple-card border-dashed p-14 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h3 className="text-lg font-semibold mb-2">No roles imported yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Connect your Gmail to automatically pull in job alerts from LinkedIn, Indeed, Monster and more. Each job gets ATS-scored against your resume and a tailored version is generated.
          </p>
          <button
            onClick={connectGmail}
            className="text-sm font-semibold px-6 py-3 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Sync Gmail →
          </button>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="max-w-[960px] mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Today's Roles</h1>
          <p className="text-xs text-muted-foreground mb-5">
            {isRunning ? `Analyzing ${jobs.length} roles…` : `${jobs.length} roles ready · click to review your tailored resume`}
            {aiRemaining !== null && (
              <span className="ml-2 text-muted-foreground/60">· {aiRemaining}/{aiLimit} AI calls left today</span>
            )}
            {lastSyncedAt && (
              <span className="ml-2 text-muted-foreground/60">
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
          <div className="flex items-center gap-3">
            <Spinner size={13} />
            <div>
              <div className="flex justify-between mb-1">
                <span className="animate-pulse-dot text-[11px] text-muted-foreground">Analyzing {doneCount}/{jobs.length}…</span>
                <span className="text-[11px] text-muted-foreground/60 ml-2.5">{pct}%</span>
              </div>
              <div className="bg-secondary rounded-full h-1 w-[140px] overflow-hidden">
                <div className="bg-foreground h-1 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAllScores}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Clear all scores
            </button>
            <div className="flex gap-1">
              {([["must", "hsl(var(--success))", buckets.must.length], ["tweak", "hsl(var(--warning))", buckets.tweak.length], ["low", "hsl(var(--danger))", buckets.low.length]] as const).map(([k, c, n]) => (
                <div key={k} className="flex items-center gap-1 bg-secondary rounded-full px-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                  <span className="text-[11px] text-secondary-foreground font-medium">{n as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gmail Sync Status Bar */}
      <div className="mb-5 apple-card px-5 py-3.5 flex items-center justify-between">
        {syncStatus === "never_synced" || syncStatus === "idle" ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">Connect Gmail to import more job alerts</span>
            </div>
            <button onClick={connectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity">
              Connect Gmail →
            </button>
          </>
        ) : syncStatus === "syncing" ? (
          <div className="flex items-center gap-2.5">
            <Spinner size={12} />
            <span className="text-xs text-muted-foreground animate-pulse">Syncing your Gmail job alerts…</span>
          </div>
        ) : syncStatus === "success" ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-success" />
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
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              Refresh ↻
            </button>
          </>
        ) : syncStatus === "error" ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs text-destructive">Sync failed — tap to retry</span>
            </div>
            <button
              onClick={() => triggerSync(false)}
              disabled={gmailLoading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              Retry
            </button>
          </>
        ) : syncStatus === "no_token" ? (
          <>
            <div className="flex items-center gap-2.5 flex-1 mr-3">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-xs text-muted-foreground">Gmail access not granted. Sign out and sign back in — make sure to check the Gmail permission on the Google screen.</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={connectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity">Reconnect Gmail</button>
              <button onClick={signOut} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Sign out</button>
            </div>
          </>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
              activeFilterCount > 0
                ? "bg-foreground/[0.06] text-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <div className="ml-auto flex gap-1">
            {([["must", "hsl(var(--success))", buckets.must.length], ["tweak", "hsl(var(--warning))", buckets.tweak.length], ["low", "hsl(var(--danger))", buckets.low.length]] as const).map(([k, c, n]) => (
              <div key={k} className="flex items-center gap-1 bg-secondary rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                <span className="text-[11px] text-secondary-foreground font-medium">{n as number}</span>
              </div>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 apple-card p-4 animate-fade-up">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Role Family</label>
              <select
                value={filterFamily}
                onChange={e => setFilterFamily(e.target.value as any)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="all">All Families</option>
                {ROLE_FAMILIES.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Score Bucket</label>
              <select
                value={filterBucket}
                onChange={e => setFilterBucket(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="all">All Buckets</option>
                <option value="must">Must Apply</option>
                <option value="tweak">Needs Tweaking</option>
                <option value="low">Low Alignment</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Company</label>
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground"
              >
                <option value="all">All Companies</option>
                {uniqueCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Location</label>
              <select
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground"
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
        <div className="apple-card border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No roles match your filters.</p>
          <button onClick={clearFilters} className="text-xs text-accent hover:underline mt-2">Clear filters</button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedData.map(({ familyKey, label, jobs: familyJobs, bucketGroups }) => {
            const isCollapsed = collapsedFamilies.has(familyKey);
            return (
              <div key={familyKey}>
                <button
                  onClick={() => toggleFamily(familyKey)}
                  className="flex items-center gap-2 w-full text-left mb-2.5 group"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  <h2 className="text-[15px] font-semibold">{label}</h2>
                  <span className="text-[11px] text-muted-foreground font-medium">({familyJobs.length})</span>
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-3 ml-5">
                    {(["must", "tweak", "low", "unscored"] as const).map(bucketKey => {
                      const bucketJobs = bucketGroups[bucketKey];
                      if (bucketJobs.length === 0) return null;
                      const bm = bucketKey !== "unscored" ? BUCKET_META[bucketKey] : null;
                      return (
                        <div key={bucketKey}>
                          <div className="flex items-center gap-1.5 mb-2">
                            {bm ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold" style={{ background: bm.bg, border: `1px solid ${bm.border}`, color: bm.text }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: bm.dot }} />
                                {bm.label} ({bucketJobs.length})
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-medium">Not scored yet ({bucketJobs.length})</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {bucketJobs.map((job, i) => {
                              const r = results[job.id];
                              return (
                                <div
                                  key={job.id}
                                  onClick={() => setSelected(job)}
                                  className="group apple-card apple-card-interactive p-4 grid animate-fade-up"
                                  style={{ gridTemplateColumns: "38px 1fr auto 100px", gap: 12, alignItems: "center", animationDelay: `${i * 0.04}s` }}
                                >
                                  <div className="w-[38px] h-[38px] bg-secondary rounded-lg flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-secondary-foreground">{initials(job.company)}</span>
                                  </div>
                                  <div>
                                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                                      <span className="text-sm font-semibold">{cleanText(job.title)}</span>
                                      {job.source && <span className="text-[10px] text-muted-foreground bg-secondary rounded-md px-1.5 py-0.5">{job.source}</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{job.company} · {job.location || "Remote"}{job.salary ? ` · ${job.salary}` : ""}</div>
                                    {r && (
                                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                                        {r.missingKeywords?.slice(0, 4).map(kw => <Tag key={kw}>{kw}</Tag>)}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteJob(job); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                    title="Delete job"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="text-right">
                                    {aLoading.has(job.id) ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <Spinner size={14} />
                                        <span className="animate-pulse-dot text-[10px] text-muted-foreground">Scoring…</span>
                                      </div>
                                    ) : r ? (
                                      <div className="flex flex-col items-end">
                                        <div className="text-2xl font-semibold leading-none tabular-nums" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleScoreJob(job, true); }}
                                          disabled={aLoading.size > 0}
                                          className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5 underline underline-offset-2 disabled:opacity-40"
                                        >
                                          {rLoading.has(job.id) ? "writing…" : "Re-score"}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleScoreJob(job); }}
                                        disabled={aLoading.size > 0}
                                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                                      >
                                        Score
                                      </button>
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

      {/* Sync Log */}
      {syncLog.length > 0 && import.meta.env.DEV && (
        <div className="mt-6 mb-4">
          <button
            onClick={() => setShowSyncLog(!showSyncLog)}
            className="text-[11px] text-muted-foreground hover:text-foreground mb-1"
          >
            {showSyncLog ? "▾ Hide" : "▸ Show"} Sync Log ({syncLog.length} entries)
          </button>
          {showSyncLog && (
            <div className="apple-card p-3 font-mono text-[11px] text-muted-foreground max-h-[200px] overflow-y-auto">
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
