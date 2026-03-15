import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AIQuotaBadge } from "@/components/AIQuotaBadge";
import { callAI } from "@/lib/ai";
import { initials } from "@/data/seed";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import GroupedJobList from "@/components/GroupedJobList";

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

interface NetResult {
  connectionAngles?: string[];
  searchQueries?: string[];
  outreachMessages?: { persona: string; message: string }[];
  insiderQuestions?: string[];
  contentAngle?: string;
  error?: boolean;
}

const Networking = () => {
  const [searchParams] = useSearchParams();
  const { data: profile } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [netJob, setNetJob] = useState<Job | null>(null);
  const [netResult, setNetResult] = useState<Record<string, NetResult>>({});
  const [netLoading, setNetLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("imported_jobs")
        .select("id, title, company, location, description, snippet")
        .eq("profile_id", profile.id)
        .order("imported_at", { ascending: false })
        .limit(50);
      if (data) setJobs(data);
    };
    load();
  }, [profile?.id]);

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && !netJob && jobs.length > 0) {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        setNetJob(job);
        if (!netResult[job.id]) generateNetworking(job);
      }
    }
  }, [searchParams, jobs]);

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const generateNetworking = async (job: Job) => {
    setNetLoading(job.id);
    try {
      const raw = await callAI(`You are a career networking strategist. Return ONLY valid JSON.
Candidate: ${profile?.full_name || "Job seeker"}.
Target role: ${job.title} at ${job.company} in ${job.location || "Remote"}
Job description: ${job.description || job.snippet || "No description available"}

Return: {
  "connectionAngles": ["3 specific types of people to find at ${job.company} on LinkedIn"],
  "searchQueries": ["3 exact LinkedIn search strings"],
  "outreachMessages": [{"persona": "type of person", "message": "short warm DM, 3 sentences, specific to the candidate's background"}],
  "insiderQuestions": ["4 smart questions to ask connections"],
  "contentAngle": "one LinkedIn post idea to get on ${job.company} employees' radar"
}`, 900, "networking");
      setNetResult(prev => ({ ...prev, [job.id]: JSON.parse(raw) }));
    } catch { setNetResult(prev => ({ ...prev, [job.id]: { error: true } })); }
    setNetLoading(null);
  };

  const handleSelectJob = (job: Job) => {
    setNetJob(job);
    if (!netResult[job.id]) generateNetworking(job);
  };

  if (netJob) {
    const n = netResult[netJob.id];
    return (
      <div className="max-w-[880px] mx-auto px-6 py-10 animate-fade-up">
        <button onClick={() => setNetJob(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1">
          ← All roles
        </button>
        <div className="apple-card p-5 mb-4">
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{netJob.company}</div>
          <div className="text-lg font-semibold">{netJob.title}</div>
        </div>

        {netLoading === netJob.id ? (
          <div className="text-center py-14 apple-card">
            <Spinner size={20} />
            <p className="animate-pulse-dot text-xs text-muted-foreground mt-3">Finding your networking strategy…</p>
          </div>
        ) : n?.error ? (
          <div className="text-xs text-muted-foreground apple-card p-5">Analysis failed — please retry.</div>
        ) : n ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="apple-card p-5">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Who to Find on LinkedIn</div>
                {n.connectionAngles?.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2.5 text-xs leading-relaxed"><span className="font-semibold shrink-0 text-muted-foreground">{i + 1}.</span>{a}</div>
                ))}
              </div>
              <div className="apple-card p-5">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">LinkedIn Search Strings</div>
                {n.searchQueries?.map((q, i) => (
                  <div key={i} onClick={() => copy(q)} className="bg-background border border-border rounded-lg p-2.5 mb-2 text-xs font-mono cursor-pointer hover:bg-secondary/60 transition-colors">
                    {q} <span className="text-[10px] text-muted-foreground">· click to copy</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Outreach Messages</div>
              {n.outreachMessages?.map((m, i) => (
                <div key={i} className="bg-background border border-border rounded-xl p-4 mb-2.5">
                  <div className="text-[10.5px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">{m.persona}</div>
                  <p className="text-xs leading-relaxed mb-3">{m.message}</p>
                  <button onClick={() => copy(m.message)} className="bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-secondary/80 transition-colors">Copy message</button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-5" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-success">Smart Questions to Ask</div>
                {n.insiderQuestions?.map((q, i) => (
                  <div key={i} className="flex gap-2 mb-2.5 text-xs leading-relaxed text-foreground">
                    <span className="text-success font-medium">Q{i + 1}</span>{q}
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-5" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-warning">LinkedIn Content Angle</div>
                <p className="text-xs leading-relaxed text-foreground">{n.contentAngle}</p>
                <button onClick={() => copy(n.contentAngle || "")} className="mt-3 bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-secondary/80 transition-colors">Copy idea</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-[880px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Networking Intelligence</h1>
      <p className="text-xs text-muted-foreground mb-6">Pick a role — get exactly who to find on LinkedIn, what to say, and how to get on their radar <AIQuotaBadge feature="networking" /></p>
      <GroupedJobList
        jobs={jobs}
        onSelect={handleSelectJob}
        ctaLabel="Get connections →"
      />
    </div>
  );
};

export default Networking;
