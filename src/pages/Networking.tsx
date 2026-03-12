import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { initials } from "@/data/seed";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import GroupedJobList from "@/components/GroupedJobList";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-border border-t-foreground rounded-full animate-spin" style={{ width: size, height: size }} />
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
      <div className="max-w-[880px] mx-auto p-7 animate-fade-up">
        <button onClick={() => setNetJob(null)} className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors">
          ← All roles
        </button>
        <div className="bg-card border border-border rounded-[11px] p-4 mb-3.5">
          <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">{netJob.company}</div>
          <div className="font-serif text-lg">{netJob.title}</div>
        </div>

        {netLoading === netJob.id ? (
          <div className="text-center py-12 bg-card border border-border rounded-[11px]">
            <Spinner size={20} />
            <p className="animate-pulse-dot text-xs text-muted-foreground mt-3">Finding your networking strategy…</p>
          </div>
        ) : n?.error ? (
          <div className="text-xs text-muted-foreground p-5">Analysis failed — please retry.</div>
        ) : n ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-[11px] p-4">
                <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-3">Who to Find on LinkedIn</div>
                {n.connectionAngles?.map((a, i) => (
                  <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed"><span className="font-bold shrink-0">{i + 1}.</span>{a}</div>
                ))}
              </div>
              <div className="bg-card border border-border rounded-[11px] p-4">
                <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-3">LinkedIn Search Strings</div>
                {n.searchQueries?.map((q, i) => (
                  <div key={i} onClick={() => copy(q)} className="bg-secondary border border-border rounded-[6px] p-2 mb-2 text-xs font-mono cursor-pointer hover:bg-muted transition-colors">
                    {q} <span className="text-[10px] text-muted-foreground">· click to copy</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-[11px] p-4">
              <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-3">Outreach Messages</div>
              {n.outreachMessages?.map((m, i) => (
                <div key={i} className="bg-secondary border border-border rounded-lg p-3.5 mb-2.5">
                  <div className="text-[10.5px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">{m.persona}</div>
                  <p className="text-xs leading-relaxed mb-2">{m.message}</p>
                  <button onClick={() => copy(m.message)} className="bg-card border border-border text-secondary-foreground rounded-[5px] px-2.5 py-1 text-[11.5px]">Copy message</button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[11px] p-4" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "hsl(var(--success))" }}>Smart Questions to Ask</div>
                {n.insiderQuestions?.map((q, i) => (
                  <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed text-foreground">
                    <span style={{ color: "hsl(var(--success))" }}>Q{i + 1}</span>{q}
                  </div>
                ))}
              </div>
              <div className="rounded-[11px] p-4" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "hsl(var(--warning))" }}>LinkedIn Content Angle</div>
                <p className="text-xs leading-relaxed text-foreground">{n.contentAngle}</p>
                <button onClick={() => copy(n.contentAngle || "")} className="mt-2.5 bg-card border border-border text-secondary-foreground rounded-[5px] px-2.5 py-1 text-[11.5px]">Copy idea</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-[880px] mx-auto p-7 pt-9">
      <h1 className="font-serif text-[26px] font-normal mb-1">Networking Intelligence</h1>
      <p className="text-xs text-muted-foreground mb-5">Pick a role — get exactly who to find on LinkedIn, what to say, and how to get on their radar</p>
      <GroupedJobList
        jobs={jobs}
        onSelect={handleSelectJob}
        ctaLabel="Get connections →"
      />
    </div>
  );
};

export default Networking;
