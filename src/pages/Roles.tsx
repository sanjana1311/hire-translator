import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { useGmailImport } from "@/hooks/use-gmail-import";
import { GmailSyncSummary } from "@/components/GmailSyncSummary";

import { useProfile } from "@/hooks/use-profile";
import { useResume } from "@/hooks/use-resume";
import { useAIUsage } from "@/hooks/use-ai-usage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cleanText } from "@/lib/clean-text";
import { parseJsonLoose, normalizeAnalysis, failedAnalysis, type ScoreAnalysis } from "@/lib/safe-json";
import { loadJobScores, saveJobScore, deleteJobScore, mergeScores, removeScore } from "@/lib/job-scores";
import { buildTailorPrompt, validateTailoredResume, tailoredResumeToText, type TailoredResume } from "@/lib/resume-guard";
import TailoredResumeView from "@/components/TailoredResumeView";
import TailoredResumeDocument from "@/components/TailoredResumeDocument";


import {
  BUCKET_META,
  initials, scoreColor, scoreBg, scoreBorder,
} from "@/data/seed";
import { classifyRole, getRoleFamilyLabel, ROLE_FAMILIES, type RoleFamilyKey } from "@/lib/role-classifier";
import { getFreshness, FRESHNESS_STYLES, STALE_AFTER_DAYS, AGING_AFTER_DAYS, type FreshnessLevel } from "@/lib/job-freshness";
import { ChevronDown, ChevronRight, SlidersHorizontal, X, Trash2, AlertTriangle, Clock, CheckCircle2, MoreHorizontal, Sparkles } from "lucide-react";

const parseStoredResume = (value: string): TailoredResume | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && parsed.summary ? (parsed as TailoredResume) : null;
  } catch {
    return null;
  }
};

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

type AnalysisResult = ScoreAnalysis;

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
  const [tailorErrors, setTailorErrors] = useState<Record<string, string>>({});
  const [doneCount, setDone] = useState(0);
  const [selected, setSelected] = useState<ImportedJob | null>(null);
  
  const [rtab, setRtab] = useState("tailored");
  const [copied, setCopied] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { data: profile } = useProfile();
  const { data: resumeData } = useResume();
  const { triggerSync, connectGmail, signOut, loading: gmailLoading, lastSyncedAt, jobsImportedCount, syncStatus, syncLog, syncReport, syncReportAt, syncCounts, syncErrors, syncError } = useGmailImport(profile?.id ?? null);
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
        confirmed_at: d.confirmed_at ?? null,
        import_batch_id: d.import_batch_id ?? null,
        archived_at: d.archived_at ?? null,
      }));
      setJobs(mapped);

      const loadedResults: Record<string, AnalysisResult> = {};
      const loadedResumes: Record<string, string> = {};
      for (const job of mapped) {
        if (job.analysis && !job.analysis.error) {
          loadedResults[job.id] = normalizeAnalysis(job.analysis);
        }
        if (job.tailored_resume) {
          loadedResumes[job.id] = job.tailored_resume;
        }
      }

      // Authoritative store: every score ever saved for this user, keyed by
      // profile + job + resume version. Loaded on every mount/refresh and
      // merged so no previously scored job is ever dropped.
      const persisted = await loadJobScores(profile.id);
      const merged = mergeScores(loadedResults, persisted);

      setResults(prev => mergeScores(prev, merged));
      setResumes(prev => ({ ...prev, ...loadedResumes }));
      setDone(Object.keys(merged).length);
    }

    const { data: apps } = await supabase
      .from("applications")
      .select("imported_job_id,status")
      .eq("profile_id", profile.id);
    if (apps) {
      setAppliedJobs(new Set(apps.map(d => d.imported_job_id).filter(Boolean) as string[]));
      const statusMap: Record<string, string> = {};
      for (const a of apps as any[]) if (a.imported_job_id) statusMap[a.imported_job_id] = a.status;
      setAppStatuses(statusMap);
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
      toast.error("Add your resume before scoring", {
        action: {
          label: "Go to Resume",
          onClick: () => navigate("/dashboard/resume"),
        },
      });
      return;
    }

    if (aLoading.size > 0) {
      toast.info("Another job is being scored — wait for it to finish");
      return;
    }
    if (force) {
      // Only this job's score is cleared — every other saved score stays.
      setResults(prev => removeScore(prev, job.id));
      setDone(prev => Math.max(0, prev - 1));
      await supabase
        .from("imported_jobs")
        .update({ analysis: null, status: "new" } as any)
        .eq("id", job.id);
      if (profile?.id) await deleteJobScore(profile.id, job.id);
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

    const schema = `{"score":<0-100 number>,"bucket":"must"|"tweak"|"low","matchSummary":"<max 2 short sentences>","strengths":["<3 items, max 12 words each>"],"gaps":["<3 items, max 12 words each>"],"missingKeywords":["<5 keywords, 1-3 words each>"],"recommendation":"<1 short sentence>"}`;

    const basePrompt = `You are a strict ATS resume matcher. Analyze the SPECIFIC requirements of this job against the candidate's ACTUAL skills and experience.

RESUME:
${resumeText}

---
JOB: ${job.title} at ${job.company}
DESCRIPTION:
${jobDesc}
---

SCORING GUIDE:
- 85-100: matches 80%+ of required skills AND seniority
- 70-84: most skills match, missing 1-2 key requirements
- 55-69: partial match, several gaps
- 40-54: weak match, major skill gaps
- Below 40: poor fit, different domain/seniority

CRITICAL: the score MUST reflect how many of THIS job's specific requirements appear in the resume.
bucket: "must" if score>=75, "tweak" if 40-74, "low" if <40.

OUTPUT RULES (strict):
- Reply with ONE valid JSON object only. No markdown, no code fences, no commentary.
- Follow this exact schema and key names:
${schema}
- Keep every string short so the JSON is complete and never truncated.`;

    const requestScore = async (prompt: string) => {
      const raw = await callAI(prompt, 1600, "roles");
      return parseJsonLoose<Record<string, unknown>>(raw);
    };

    try {
      let parsed = await requestScore(basePrompt);

      if (!parsed) {
        // Retry once with a correction prompt — output only, kept very short.
        console.warn("[Roles] Scoring output unparseable, retrying with correction prompt");
        parsed = await requestScore(
          `${basePrompt}

Your previous reply was not valid JSON or was cut off. Reply again with ONLY the JSON object, minified, using the shortest possible strings.`,
        );
      }

      if (parsed) {
        const normalized = normalizeAnalysis(parsed);
        scoreResult = normalized;
        // Merge: adds/updates only this job, keeps all other scores visible.
        setResults(prev => mergeScores(prev, { [job.id]: normalized }));
        await supabase
          .from("imported_jobs")
          .update({ analysis: normalized as any, status: "scored" })
          .eq("id", job.id);
        if (profile?.id) {
          await saveJobScore({
            profileId: profile.id,
            jobId: job.id,
            resumeId: resumeData?.id ?? null,
            analysis: normalized,
          });
        }
      } else {
        const errResult = failedAnalysis();
        setResults(prev => ({ ...prev, [job.id]: errResult }));
        toast.error("Scoring temporarily failed — please retry this job");
        await supabase
          .from("imported_jobs")
          .update({ analysis: errResult as any, status: "error" })
          .eq("id", job.id);
      }
    } catch (e: any) {
      console.error("Scoring call failed:", e);
      const errResult = failedAnalysis();
      setResults(prev => ({ ...prev, [job.id]: errResult }));
      toast.error("Scoring temporarily failed — please retry this job");
    }
    setDone(prev => prev + 1);
    setAL(prev => { const s = new Set(prev); s.delete(job.id); return s; });
  };


  const generateTailoredResume = async (job: ImportedJob) => {
    if (!resumeText) return;
    const r = results[job.id];
    if (!r || r.error) return;
    const jobDesc = job.description || job.snippet || `${job.title} at ${job.company}`;
    setTailorErrors(prev => { const next = { ...prev }; delete next[job.id]; return next; });
    setRL(prev => new Set([...prev, job.id]));
    try {
      const basePrompt = buildTailorPrompt({
        resumeText,
        jobTitle: job.title,
        company: job.company,
        jobDescription: jobDesc,
        missingKeywords: r.missingKeywords,
      });
      const requestTailored = (prompt: string) =>
        callAI(prompt, 8000, "resume-rewrite", {
          jobId: job.id,
          resumeId: resumeData?.id,
          resumeTextLength: resumeText.length,
          jobDescriptionLength: jobDesc.length,
        });

      const readTailored = (raw: string) => {
        const parsed = parseJsonLoose(raw) as Partial<TailoredResume> | null;
        const ok = !!parsed && (!!parsed.summary || !!parsed.experience?.length || !!parsed.tailored_sections?.length);
        return ok ? parsed : null;
      };

      let parsed: Partial<TailoredResume> | null = null;
      try {
        parsed = readTailored(await requestTailored(basePrompt));
      } catch (firstError: any) {
        // A cut-off reply is retryable; anything else (quota, auth) is not.
        if (firstError?.code !== "AI_RESPONSE_TRUNCATED") throw firstError;
      }

      if (!parsed) {
        // Retry once asking for a compact reply so the JSON completes.
        parsed = readTailored(
          await requestTailored(
            `${basePrompt}

Your previous reply was cut off before the JSON closed. Reply again with ONLY the JSON object, minified, no code fences. Keep every bullet under 220 characters and include at most 4 bullets per role so the object finishes.`,
          ),
        );
      }
      if (!parsed) throw new Error("Tailoring temporarily failed — please retry");


      const { resume: validated, rejectedCount } = validateTailoredResume(parsed as TailoredResume, resumeText);

      const payload = JSON.stringify(validated);
      setResumes(prev => ({ ...prev, [job.id]: payload }));
      await supabase
        .from("imported_jobs")
        .update({ tailored_resume: payload })
        .eq("id", job.id);
      refreshAIUsage();
      if (rejectedCount > 0) {
        toast.warning(`${rejectedCount} unsupported claim${rejectedCount > 1 ? "s" : ""} removed — review before applying`);
      } else {
        toast.success("Tailored resume ready — review AI changes before applying");
      }
    } catch (e: any) {
      // Tailoring failures never touch scoring state — saved scores stay intact.
      console.error('Resume rewrite failed:', e);
      const requestSuffix = e?.requestId ? ` (Request ${e.requestId})` : "";
      const message = `${e?.message || "Tailoring temporarily failed — please retry"}${requestSuffix}`;
      setTailorErrors(prev => ({ ...prev, [job.id]: message }));
      toast.error("Couldn't tailor your resume — your job score is still saved.", {
        description: message,
        action: { label: "Retry", onClick: () => generateTailoredResume(job) },
      });
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
      setResults(prev => removeScore(prev, job.id));
      setResumes(prev => { const n = { ...prev }; delete n[job.id]; return n; });
      await deleteJobScore(profile.id, job.id);
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
      if (profile?.id) await deleteJobScore(profile.id, id);
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
  const [filterAge, setFilterAge] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "match">("newest");
  const [showMore, setShowMore] = useState(false);

  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());

  const toggleFamily = (key: string) => {
    setCollapsedFamilies(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const classifiedJobs = useMemo(() =>
    jobs.map(job => ({
      ...job,
      roleFamily: classifyRole(job.title),
      freshness: getFreshness(job.imported_at, appliedJobs.has(job.id)),
    })),
    [jobs, appliedJobs]
  );

  const uniqueCompanies = useMemo(() =>
    [...new Set(jobs.map(j => j.company))].sort(),
    [jobs]
  );
  const uniqueLocations = useMemo(() =>
    [...new Set(jobs.map(j => j.location || "Remote"))].sort(),
    [jobs]
  );

  // Jobs that arrived in the most recent import batch (within 15 min of the newest import)
  const newBatchIds = useMemo(() => {
    if (classifiedJobs.length === 0) return new Set<string>();
    const times = classifiedJobs.map(j => new Date(j.imported_at).getTime()).filter(t => !Number.isNaN(t));
    if (times.length === 0) return new Set<string>();
    const newest = Math.max(...times);
    // Only treat as "this sync" if the batch landed in the last 48h
    if (Date.now() - newest > 48 * 60 * 60 * 1000) return new Set<string>();
    const cutoff = newest - 15 * 60 * 1000;
    return new Set(
      classifiedJobs.filter(j => new Date(j.imported_at).getTime() >= cutoff).map(j => j.id)
    );
  }, [classifiedJobs]);

  const filteredJobs = useMemo(() => {
    const list = classifiedJobs.filter(job => {
      if (filterFamily !== "all" && job.roleFamily !== filterFamily) return false;
      if (filterBucket !== "all") {
        const r = results[job.id];
        if (filterBucket === "unscored") {
          if (r) return false;
        } else if (!r || r.bucket !== filterBucket) return false;
      }
      if (filterCompany !== "all" && job.company !== filterCompany) return false;
      if (filterLocation !== "all" && (job.location || "Remote") !== filterLocation) return false;
      if (filterAge !== "all" && job.freshness.level !== filterAge) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "match") {
        const sa = results[a.id]?.score ?? -1;
        const sb = results[b.id]?.score ?? -1;
        if (sb !== sa) return sb - sa;
      }
      return new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime();
    });
  }, [classifiedJobs, filterFamily, filterBucket, filterCompany, filterLocation, filterAge, results, sortBy]);

  const bucketGroupsOf = useCallback((list: typeof filteredJobs) => ({
    must: list.filter(j => results[j.id]?.bucket === "must"),
    tweak: list.filter(j => results[j.id]?.bucket === "tweak"),
    low: list.filter(j => results[j.id]?.bucket === "low"),
    unscored: list.filter(j => !results[j.id]),
  }), [results]);

  const newGroup = useMemo(() => {
    const list = filteredJobs.filter(j => newBatchIds.has(j.id));
    if (list.length === 0 || list.length === filteredJobs.length) return null;
    return { familyKey: "__new" as const, label: "New this sync", jobs: list, bucketGroups: bucketGroupsOf(list) };
  }, [filteredJobs, newBatchIds, bucketGroupsOf]);

  const groupedData = useMemo(() => {
    const rest = newGroup ? filteredJobs.filter(j => !newBatchIds.has(j.id)) : filteredJobs;
    const familyMap: Record<string, typeof filteredJobs> = {};
    for (const job of rest) {
      const key = job.roleFamily;
      if (!familyMap[key]) familyMap[key] = [];
      familyMap[key].push(job);
    }

    const familyOrder = [...ROLE_FAMILIES.map(f => f.key), "other"];
    const sortedFamilies = Object.keys(familyMap).sort(
      (a, b) => familyOrder.indexOf(a) - familyOrder.indexOf(b)
    );

    const families = sortedFamilies.map(familyKey => {
      const familyJobs = familyMap[familyKey];
      return { familyKey: familyKey as RoleFamilyKey, label: getRoleFamilyLabel(familyKey as RoleFamilyKey), jobs: familyJobs, bucketGroups: bucketGroupsOf(familyJobs) };
    });

    return newGroup ? [newGroup as any, ...families] : families;
  }, [filteredJobs, results, newGroup, newBatchIds, bucketGroupsOf]);

  const buckets = {
    must: jobs.filter(j => results[j.id]?.bucket === "must"),
    tweak: jobs.filter(j => results[j.id]?.bucket === "tweak"),
    low: jobs.filter(j => results[j.id]?.bucket === "low"),
    unscored: jobs.filter(j => !results[j.id]),
  };


  const freshnessCounts = useMemo(() => {
    const counts: Record<FreshnessLevel, number> = { applied: 0, fresh: 0, aging: 0, stale: 0 };
    for (const job of classifiedJobs) counts[job.freshness.level]++;
    return counts;
  }, [classifiedJobs]);

  const activeFilterCount = [filterFamily, filterBucket, filterCompany, filterLocation, filterAge].filter(v => v !== "all").length;

  const clearFilters = () => {
    setFilterFamily("all");
    setFilterBucket("all");
    setFilterCompany("all");
    setFilterLocation("all");
    setFilterAge("all");
  };

  // ── Import quality + status derivation ──────────────────────────────────
  const assessments = useMemo(() => {
    const map: Record<string, ReturnType<typeof assessJob>> = {};
    for (const job of jobs) map[job.id] = assessJob(job);
    return map;
  }, [jobs]);

  const statusOf = useCallback((job: ImportedJob): RoleStatus => {
    const score = results[job.id];
    return deriveRoleStatus({
      needsReview: (assessments[job.id] ?? assessJob(job)).needsReview,
      hasScore: !!score && !score.error,
      hasTailoredResume: !!resumes[job.id],
      applicationStatus: appStatuses[job.id] ?? null,
      archived: !!(job as any).archived_at,
    });
  }, [results, resumes, assessments, appStatuses]);

  const needsReviewJobs = useMemo(
    () => jobs.filter(j => (assessments[j.id]?.needsReview ?? false)),
    [jobs, assessments]
  );

  /** Roles from the most recent import batch (batch id when present, else a 15-min window). */
  const latestBatchJobs = useMemo(() => {
    if (jobs.length === 0) return [] as ImportedJob[];
    const newest = jobs.reduce((a, b) =>
      new Date(a.imported_at).getTime() >= new Date(b.imported_at).getTime() ? a : b
    );
    if (newest.import_batch_id) return jobs.filter(j => j.import_batch_id === newest.import_batch_id);
    const cutoff = new Date(newest.imported_at).getTime() - 15 * 60 * 1000;
    return jobs.filter(j => new Date(j.imported_at).getTime() >= cutoff);
  }, [jobs]);

  const batchIsToday = useMemo(() => {
    const first = latestBatchJobs[0];
    return !!first && new Date(first.imported_at).toDateString() === new Date().toDateString();
  }, [latestBatchJobs]);

  const relativeSync = useMemo(() => {
    if (!lastSyncedAt) return null;
    const mins = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [lastSyncedAt]);

  const latestIds = useMemo(() => new Set(latestBatchJobs.map(j => j.id)), [latestBatchJobs]);
  const latestVisible = useMemo(() => filteredJobs.filter(j => latestIds.has(j.id)), [filteredJobs, latestIds]);

  const latestFamilies = useMemo(() => {
    const familyMap: Record<string, typeof latestVisible> = {};
    for (const job of latestVisible) {
      (familyMap[job.roleFamily] ||= []).push(job);
    }
    const order = [...ROLE_FAMILIES.map(f => f.key), "other"];
    return Object.keys(familyMap)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map(key => {
        const familyJobs = familyMap[key];
        return {
          familyKey: key as RoleFamilyKey,
          label: getRoleFamilyLabel(key as RoleFamilyKey),
          jobs: familyJobs,
          counts: {
            needsReview: familyJobs.filter(j => statusOf(j) === "needs_review").length,
            scored: familyJobs.filter(j => !!results[j.id] && !results[j.id].error).length,
            applied: familyJobs.filter(j => appliedJobs.has(j.id)).length,
          },
        };
      });
  }, [latestVisible, statusOf, results, appliedJobs]);

  const historyGroups = useMemo(() => {
    const older = filteredJobs.filter(j => !latestIds.has(j.id));
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(new Date());
    const yesterday = today - 86400000;
    const weekStart = today - 7 * 86400000;
    const groups: { label: string; jobs: typeof older }[] = [
      { label: "Yesterday", jobs: [] },
      { label: "Earlier this week", jobs: [] },
      { label: "Older", jobs: [] },
    ];
    for (const job of older) {
      const t = startOfDay(new Date(job.imported_at));
      if (t >= yesterday) groups[0].jobs.push(job);
      else if (t >= weekStart) groups[1].jobs.push(job);
      else groups[2].jobs.push(job);
    }
    return groups.filter(g => g.jobs.length > 0);
  }, [filteredJobs, latestIds]);

  const handleConfirmJob = async (job: ImportedJob) => {
    const confirmedAt = new Date().toISOString();
    const { error } = await supabase
      .from("imported_jobs")
      .update({ confirmed_at: confirmedAt } as any)
      .eq("id", job.id);
    if (error) { toast.error(error.message); return; }
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, confirmed_at: confirmedAt } : j)));
    setSelected(prev => (prev && prev.id === job.id ? { ...prev, confirmed_at: confirmedAt } : prev));
    toast.success("Role confirmed — moved out of Needs your review");
  };

  /** Exactly one next action per role, driven by its current status. */
  const handleNextAction = (job: ImportedJob) => {
    switch (statusOf(job)) {
      case "needs_review":
        setSelected(job);
        break;
      case "confirmed":
        handleScoreJob(job);
        break;
      case "scored":
        setSelected(job);
        setRtab("tailored");
        if (!resumes[job.id]) generateTailoredResume(job);
        break;
      case "tailored":
        handleMarkApplied(job);
        break;
      case "applied":
        navigate("/dashboard/applications");
        break;
      case "interviewing":
        navigate(`/dashboard/prep?jobId=${job.id}`);
        break;
      case "rejected":
        navigate("/dashboard/rejection");
        break;
      default:
        setSelected(job);
    }
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

            {/* Progress timeline + next action */}
            {(() => {
              const a = assessments[selected.id] ?? assessJob(selected);
              const st = statusOf(selected);
              const meta = statusMeta(st);
              const reachedIdx = ROLE_PROGRESS.indexOf(st === "interviewing" || st === "rejected" ? "applied" : st);
              return (
                <div className="apple-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium rounded-md border px-2 py-0.5 ${meta.className}`}>{meta.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Imported {importedAtLabel(selected.imported_at)}{selected.source ? ` · ${selected.source}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => handleNextAction(selected)}
                      disabled={aLoading.has(selected.id) || rLoading.has(selected.id)}
                      className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {meta.nextAction}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {["Imported", ...ROLE_PROGRESS.map(s => statusMeta(s).label)].map((label, i) => {
                      const done = i === 0 || (reachedIdx >= 0 && i <= reachedIdx + 1);
                      return (
                        <div key={label} className="flex items-center gap-1.5 flex-1 last:flex-none">
                          <span className={`text-[10.5px] font-medium whitespace-nowrap ${done ? "text-foreground" : "text-muted-foreground/50"}`}>{label}</span>
                          {i < ROLE_PROGRESS.length && (
                            <span className={`h-px flex-1 ${done ? "bg-foreground/40" : "bg-border"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {st === "needs_review" && (
                    <div className="mt-4 rounded-xl border border-warning/30 bg-warning/[0.07] p-3">
                      <p className="text-xs font-medium text-warning mb-1">Job details could not be confirmed</p>
                      <ul className="text-[11px] text-muted-foreground list-disc pl-4 mb-2.5">
                        {a.reasons.filter(x => x.severity === "high").map(x => <li key={x.message}>{x.message}</li>)}
                      </ul>
                      <button
                        onClick={() => handleConfirmJob(selected)}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
                      >
                        These details are correct
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Full job description */}
            {(selected.description || selected.snippet) && (
              <div className="apple-card p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Job description</div>
                <p className="text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
                  {cleanText(selected.description || selected.snippet || "")}
                </p>
              </div>
            )}


            {aLoading.has(selected.id) ? (
              <div className="apple-card p-12 text-center">
                <Spinner size={18} />
                <div className="animate-pulse-dot text-xs text-muted-foreground mt-3">Analyzing…</div>
              </div>
            ) : !r ? (
              <div className="apple-card p-12 text-center">
                <p className="text-xs text-muted-foreground mb-3">This role hasn't been scored yet.</p>
                <button
                  onClick={() => handleScoreJob(selected)}
                  disabled={aLoading.size > 0}
                  className="text-xs font-medium px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Score this role
                </button>
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
                {(["tailored", "analysis", "original"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setRtab(k)}
                    className={`text-xs font-medium px-3.5 py-1.5 rounded-md transition-all duration-200 ${
                      rtab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {k === "tailored" ? "Resume" : k === "analysis" ? "Analysis" : "Original"}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5 h-[calc(100vh-180px)] overflow-y-auto">
              {rtab === "analysis" ? (
                (() => {
                  const parsed = resumes[selected.id] ? parseStoredResume(resumes[selected.id]) : null;
                  return parsed ? (
                    <TailoredResumeView resume={parsed} />
                  ) : (
                    <div className="text-center py-16">
                      <p className="text-sm text-muted-foreground">Generate a tailored resume to see the evidence analysis.</p>
                    </div>
                  );
                })()
              ) : rtab === "tailored" ? (
                hasError ? (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted-foreground">Resume tailoring unavailable — scoring must succeed first.</p>
                  </div>
                ) : resumes[selected.id] ? (
                  (() => {
                    const parsed = parseStoredResume(resumes[selected.id]);
                    return parsed ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                          <p className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300 font-medium">
                            Review all AI-generated changes before applying.
                          </p>
                        </div>
                        <TailoredResumeDocument
                          resume={parsed}
                          sourceResumeText={resumeText}
                          sourceLayout={(resumeData as any)?.layout}
                          fileBase={`${selected.company}_${selected.title}_Resume`}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                          <p className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300 font-medium">
                            Review all AI-generated changes before applying.
                          </p>
                        </div>
                        <pre className="font-sans text-[11.5px] leading-[1.85] whitespace-pre-wrap break-words text-secondary-foreground">{resumes[selected.id]}</pre>
                      </div>
                    );
                  })()
                ) : rLoading.has(selected.id) ? (

                  <div className="text-center py-16">
                    <Spinner size={18} />
                    <p className="animate-pulse-dot text-sm text-muted-foreground mt-3">Writing your tailored resume…</p>
                  </div>
                ) : r ? (
                  <div className="text-center py-16">
                    {tailorErrors[selected.id] ? (
                      <div className="mx-auto mb-4 max-w-md rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-left">
                        <p className="text-sm font-medium text-destructive">
                          We couldn't tailor your resume for this role just now.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your job score is saved and unchanged. {tailorErrors[selected.id]}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-4">Tailored resume not generated yet.</p>
                    )}
                    <button
                      onClick={() => generateTailoredResume(selected)}
                      className="text-xs font-semibold px-5 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity"
                    >
                      {tailorErrors[selected.id] ? "Retry tailoring" : "Generate Tailored Resume"}
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

        <GmailSyncSummary report={syncReport} counts={syncCounts} errors={syncErrors} syncedAt={syncReportAt} loading={gmailLoading} error={syncError} onRetry={() => triggerSync(false)} />



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
      {/* 1 — Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Roles</h1>
          <p className="text-xs text-muted-foreground">
            Review imported roles and track your application progress.
            {lastSyncedAt && <span className="ml-1.5">Last synced {relativeSync}.</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {syncStatus === "never_synced" || syncStatus === "idle" || syncStatus === "no_token" ? (
            <button
              onClick={connectGmail}
              className="text-xs font-medium px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              Connect Gmail →
            </button>
          ) : (
            <button
              onClick={() => triggerSync(false)}
              disabled={gmailLoading}
              className="text-xs font-medium px-3.5 py-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {gmailLoading ? "Syncing…" : "Sync Gmail ↻"}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMore(v => !v)}
              aria-label="More actions"
              className="text-xs font-medium px-2.5 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMore && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />
                <div className="absolute right-0 mt-1.5 z-20 w-52 apple-card p-1 shadow-lg">
                  <button
                    onClick={() => { setShowMore(false); triggerSync(false, 30); }}
                    disabled={gmailLoading}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    Deep scan last 30 days
                  </button>
                  <button
                    onClick={() => { setShowMore(false); signOut(); }}
                    className="w-full text-left text-xs px-3 py-2 rounded-md hover:bg-secondary transition-colors"
                  >
                    Reconnect / sign out
                  </button>
                  <button
                    onClick={() => { setShowMore(false); handleClearAllScores(); }}
                    className="w-full text-left text-xs px-3 py-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Clear all scores
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2 — Import summary */}
      <div className="apple-card p-4 mb-5">
        <p className="text-sm font-medium mb-3">
          {latestBatchJobs.length} role{latestBatchJobs.length === 1 ? "" : "s"} imported {batchIsToday ? "today" : "in the last sync"}.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["Imported", syncCounts?.imported ?? latestBatchJobs.length, ""],
            ["Skipped", syncCounts?.skipped ?? 0, ""],
            ["Failed", syncCounts?.failed ?? 0, ""],
            ["Needs review", needsReviewJobs.length, needsReviewJobs.length > 0 ? "text-warning" : ""],
            ["Last synced", relativeSync ?? "Never", "text-[13px]"],
          ].map(([label, value, cls]) => (
            <div key={label as string}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label as string}</div>
              <div className={`text-lg font-semibold tabular-nums ${cls as string}`}>{value as any}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gmail sync status — only when something needs attention */}
      {(syncStatus === "syncing" || syncStatus === "error" || syncStatus === "no_token") && (
        <div className="mb-5 apple-card px-5 py-3 flex items-center justify-between gap-3">
          {syncStatus === "syncing" ? (
            <div className="flex items-center gap-2.5">
              <Spinner size={12} />
              <span className="text-xs text-muted-foreground animate-pulse">Syncing your Gmail job alerts…</span>
            </div>
          ) : syncStatus === "error" ? (
            <>
              <span className="text-xs text-destructive truncate">Sync failed — tap to retry</span>
              <button
                onClick={() => triggerSync(false)}
                disabled={gmailLoading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">Gmail access not granted — sign out and back in, and tick the Gmail permission.</span>
              <button onClick={signOut} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0">Sign out</button>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 ${
              activeFilterCount > 0 ? "bg-foreground/[0.06] text-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as "newest" | "match")}
            aria-label="Sort roles"
            className="text-[11px] bg-secondary border border-transparent rounded-lg px-2 py-1.5 text-secondary-foreground font-medium"
          >
            <option value="newest">Newest first</option>
            <option value="match">Best match</option>
          </select>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {([["must", "hsl(var(--success))", "Must apply", buckets.must.length], ["tweak", "hsl(var(--warning))", "Tweak", buckets.tweak.length], ["low", "hsl(var(--danger))", "Low", buckets.low.length]] as const).map(([k, c, label, n]) => (
              <button
                key={k}
                onClick={() => setFilterBucket(filterBucket === k ? "all" : k)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${filterBucket === k ? "bg-foreground/[0.08]" : "bg-secondary hover:bg-secondary/70"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c as string }} />
                <span className="text-[11px] text-secondary-foreground font-medium">{label as string} {n as number}</span>
              </button>
            ))}
            {buckets.unscored.length > 0 && (
              <button
                onClick={() => setFilterBucket(filterBucket === "unscored" ? "all" : "unscored")}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-border transition-colors ${filterBucket === "unscored" ? "bg-foreground/[0.08]" : "hover:bg-secondary"}`}
                title="Roles you haven't scored yet"
              >
                <Sparkles className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-secondary-foreground font-medium">Unscored {buckets.unscored.length}</span>
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 apple-card p-4 animate-fade-up">
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
                <option value="unscored">Not scored yet</option>
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

      {/* 3 — Needs your review */}
      {needsReviewJobs.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h2 className="text-[15px] font-semibold">Needs your review</h2>
            <span className="text-[11px] text-muted-foreground font-medium">({needsReviewJobs.length})</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2.5">
            We couldn't confirm the job details for these imports. Confirm or delete them so they stop cluttering your list.
          </p>
          <div className="flex flex-col gap-1.5">
            {needsReviewJobs.map(job => (
              <RoleRow
                key={job.id}
                job={job}
                assessment={assessments[job.id]}
                status="needs_review"
                onOpen={() => setSelected(job)}
                onAction={() => setSelected(job)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4 — Today's imported roles */}
      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[15px] font-semibold">{batchIsToday ? "Today's imported roles" : "Latest imported roles"}</h2>
          <span className="text-[11px] text-muted-foreground font-medium">({latestVisible.length})</span>
        </div>

        {latestVisible.length === 0 ? (
          <div className="apple-card border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">No roles from the latest sync match your filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {latestFamilies.map(({ familyKey, label, jobs: familyJobs, counts }) => {
              const isCollapsed = collapsedFamilies.has(familyKey);
              return (
                <div key={familyKey}>
                  <button onClick={() => toggleFamily(familyKey)} className="flex items-center gap-2 w-full text-left mb-2">
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {familyJobs.length} role{familyJobs.length === 1 ? "" : "s"} · {counts.needsReview} needs review · {counts.scored} scored · {counts.applied} applied
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-1.5 ml-5">
                      {familyJobs.map(job => (
                        <RoleRow
                          key={job.id}
                          job={job}
                          assessment={assessments[job.id]}
                          status={statusOf(job)}
                          score={results[job.id]?.error ? null : results[job.id]?.score}
                          busy={aLoading.has(job.id) || rLoading.has(job.id)}
                          onOpen={() => setSelected(job)}
                          onAction={() => handleNextAction(job)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5 — Import history */}
      {historyGroups.length > 0 && (
        <section className="mb-6">
          <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-2 mb-2.5">
            {showHistory ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            <h2 className="text-[15px] font-semibold">Import history</h2>
            <span className="text-[11px] text-muted-foreground font-medium">({historyGroups.reduce((n, g) => n + g.jobs.length, 0)})</span>
          </button>
          {showHistory && (
            <div className="flex flex-col gap-4">
              {historyGroups.map(group => (
                <div key={group.label}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{group.label} ({group.jobs.length})</h3>
                  <div className="flex flex-col gap-1.5">
                    {group.jobs.map(job => (
                      <RoleRow
                        key={job.id}
                        job={job}
                        assessment={assessments[job.id]}
                        status={statusOf(job)}
                        score={results[job.id]?.error ? null : results[job.id]?.score}
                        busy={aLoading.has(job.id) || rLoading.has(job.id)}
                        onOpen={() => setSelected(job)}
                        onAction={() => handleNextAction(job)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
