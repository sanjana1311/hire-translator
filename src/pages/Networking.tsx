import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AIQuotaBadge } from "@/components/AIQuotaBadge";
import { callAI } from "@/lib/ai";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import GroupedJobList from "@/components/GroupedJobList";
import TargetCard from "@/components/networking/TargetCard";
import {
  useNetworkingTargets,
  useSaveNetworkingTargets,
  useUpdateNetworkingTarget,
  useDeleteNetworkingTargets,
  linkedInSearchUrl,
  CONNECTION_TYPE_LABEL,
  type ConnectionType,
} from "@/hooks/use-networking-targets";
import { parseJsonLoose } from "@/lib/safe-json";
import { toast } from "sonner";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-foreground/10 border-t-foreground/60 rounded-full animate-spin" style={{ width: size, height: size }} />
);

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  snippet: string | null;
}

interface Suggestion {
  connectionType: string;
  headline?: string;
  matchReason?: string;
  evidence?: string;
  searchKeywords?: string;
  relevance?: number;
  outreachMessage?: string;
}

const VALID_TYPES: ConnectionType[] = [
  "hiring_manager",
  "recruiter",
  "team_member",
  "alumni",
  "former_colleague",
  "industry_connection",
];

const Networking = () => {
  const [searchParams] = useSearchParams();
  const { data: profile } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const targetsQuery = useNetworkingTargets(job?.id);
  const saveTargets = useSaveNetworkingTargets();
  const updateTarget = useUpdateNetworkingTarget();
  const clearTargets = useDeleteNetworkingTargets();

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("imported_jobs")
      .select("id, title, company, location, description, snippet")
      .eq("profile_id", profile.id)
      .order("imported_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setJobs(data as Job[]); });
  }, [profile?.id]);

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && !job && jobs.length > 0) {
      const found = jobs.find(j => j.id === jobId);
      if (found) setJob(found);
    }
  }, [searchParams, jobs, job]);

  const manualSearches = useMemo(() => {
    if (!job) return [];
    return [
      { label: "Recruiters at this company", url: linkedInSearchUrl(["recruiter", job.company]) },
      { label: "Hiring managers for this role", url: linkedInSearchUrl(["hiring manager", job.title, job.company]) },
      { label: "People in this role today", url: linkedInSearchUrl([job.title, job.company]) },
      { label: "Team in this location", url: linkedInSearchUrl([job.title, job.company, job.location]) },
    ];
  }, [job]);

  const generate = async () => {
    if (!job) return;
    setGenerating(true);
    setGenError(null);
    try {
      const raw = await callAI(
        `You are a networking strategist. Return ONLY valid JSON — no prose.

Job: ${job.title} at ${job.company}${job.location ? ` (${job.location})` : ""}
Job description: ${(job.description || job.snippet || "No description available").slice(0, 4000)}
Candidate: ${profile?.full_name || "Job seeker"}. Target roles: ${profile?.target_roles || "not specified"}.

Rules:
- NEVER invent real people, names, shared employers, schools, or experience.
- Describe target PERSONAS only (role/headline patterns), never fabricated identities.
- Every matchReason must reference only facts present in the job posting or candidate data above.

Return: {"suggestions":[{"connectionType":"hiring_manager|recruiter|team_member|alumni|former_colleague|industry_connection","headline":"typical title/headline to look for","matchReason":"why this person matters for this specific job","evidence":"which job or candidate detail this is based on","searchKeywords":"LinkedIn people-search keywords","relevance":0-100,"outreachMessage":"4-sentence warm, specific note with one clear ask"}]}
Give 6 suggestions, one per connection type, sorted by relevance descending.`,
        1400,
        "networking",
        { jobId: job.id, jobDescriptionLength: (job.description || job.snippet || "").length },
      );
      const parsed = parseJsonLoose<{ suggestions?: Suggestion[] }>(raw);
      const suggestions = parsed?.suggestions ?? [];
      if (!suggestions.length) throw new Error("No suggestions returned. Please retry.");

      await clearTargets.mutateAsync(job.id);
      await saveTargets.mutateAsync(
        suggestions.map(s => {
          const type = (VALID_TYPES as string[]).includes(s.connectionType) ? s.connectionType : "industry_connection";
          return {
            imported_job_id: job.id,
            job_title: job.title,
            company: job.company,
            location: job.location ?? "",
            name: "",
            headline: s.headline ?? CONNECTION_TYPE_LABEL[type],
            target_company: job.company,
            connection_type: type,
            match_reason: s.matchReason ?? "",
            evidence: s.evidence ?? "",
            linkedin_url: "",
            search_url: linkedInSearchUrl([s.searchKeywords || s.headline, job.company]),
            relevance: Math.max(0, Math.min(100, Math.round(Number(s.relevance) || 0))),
            outreach_message: s.outreachMessage ?? "",
            source: "suggested",
            status: "not_contacted",
          };
        }),
      );
    } catch (e) {
      setGenError((e as Error).message || "Suggestions failed. Please retry.");
    }
    setGenerating(false);
  };

  if (job) {
    const targets = targetsQuery.data ?? [];
    return (
      <div className="max-w-[880px] mx-auto px-6 py-10 animate-fade-up">
        <button onClick={() => setJob(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
          ← All roles
        </button>

        <div className="apple-card p-5 mb-3">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{job.company}</div>
          <div className="text-lg font-semibold">{job.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{job.location || "Location not listed"}</div>
        </div>

        <div className="apple-card p-4 mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Manual LinkedIn search</div>
          <div className="flex flex-wrap gap-2">
            {manualSearches.map(s => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors"
              >
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground">
            {targets.length} suggested connection{targets.length !== 1 ? "s" : ""} <AIQuotaBadge feature="networking" />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="bg-foreground text-background rounded-lg px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {generating ? "Generating…" : targets.length ? "Regenerate suggestions" : "Generate suggestions"}
          </button>
        </div>

        {genError && (
          <div className="rounded-xl p-4 mb-3 text-xs" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
            {genError}
          </div>
        )}

        {generating ? (
          <div className="text-center py-14 apple-card">
            <div className="flex justify-center"><Spinner size={20} /></div>
            <p className="animate-pulse-dot text-xs text-muted-foreground mt-3">Ranking the people to reach out to…</p>
          </div>
        ) : targetsQuery.isLoading ? (
          <div className="apple-card p-5 text-xs text-muted-foreground">Loading your networking activity…</div>
        ) : targetsQuery.error ? (
          <div className="apple-card p-5 text-xs text-muted-foreground">Could not load saved contacts. Please refresh.</div>
        ) : targets.length === 0 ? (
          <div className="apple-card p-8 text-center text-xs text-muted-foreground">
            No connections yet. Generate suggestions, or use the manual LinkedIn searches above.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {targets.map((t, i) => (
              <TargetCard
                key={t.id}
                target={t}
                rank={i + 1}
                onUpdate={(u) => updateTarget.mutate(u, { onError: () => toast.error("Could not save change") })}
              />
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
          hireOS never scrapes LinkedIn and never sends messages for you. Suggestions describe who to look for — verify every person before
          reaching out.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[880px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Networking Intelligence</h1>
      <p className="text-xs text-muted-foreground mb-6">
        Pick a role — get ranked connection types, why each matters, and a personalized outreach plan you can track.
      </p>
      <GroupedJobList jobs={jobs} onSelect={(j) => setJob(j as Job)} ctaLabel="Get connections →" />
    </div>
  );
};

export default Networking;
