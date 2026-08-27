import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AIQuotaBadge } from "@/components/AIQuotaBadge";
import { callAI } from "@/lib/ai";
import { useResume } from "@/hooks/use-resume";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import SectionShell from "@/components/prep/SectionShell";
import CompanyDeepDive, { type CompanyData } from "@/components/prep/CompanyDeepDive";
import HiringSignals, { type SignalsData } from "@/components/prep/HiringSignals";
import ResumeAlignment, { type AlignmentData } from "@/components/prep/ResumeAlignment";
import BehavioralPrep, { type BehavioralQuestion } from "@/components/prep/BehavioralPrep";
import TechnicalPrep, { type TechnicalQuestion } from "@/components/prep/TechnicalPrep";
import MockInterview from "@/components/prep/MockInterview";
import ReadinessScore from "@/components/prep/ReadinessScore";
import PrepSpinner from "@/components/prep/PrepSpinner";
import { initials } from "@/data/seed";
import GroupedJobList from "@/components/GroupedJobList";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  snippet: string | null;
}

interface PrepState {
  company: CompanyData | null;
  signals: SignalsData | null;
  alignment: AlignmentData | null;
  behavioral: BehavioralQuestion[] | null;
  technical: TechnicalQuestion[] | null;
}

const InterviewPrep = () => {
  const [searchParams] = useSearchParams();
  const { data: profile } = useProfile();
  const { data: resumeData } = useResume();
  const resumeText = resumeData?.raw_text || "";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [state, setState] = useState<PrepState>({ company: null, signals: null, alignment: null, behavioral: null, technical: null });
  const [loading, setLoading] = useState({ company: false, signals: false, alignment: false, behavioral: false, technical: false });
  const [mockCompleted, setMockCompleted] = useState(false);
  const [appStatuses, setAppStatuses] = useState<Record<string, string>>({});

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

      const { data: apps } = await supabase
        .from("applications")
        .select("imported_job_id,status")
        .eq("profile_id", profile.id);
      if (apps) {
        const map: Record<string, string> = {};
        for (const a of apps as any[]) if (a.imported_job_id) map[a.imported_job_id] = a.status;
        setAppStatuses(map);
      }
    };
    load();
  }, [profile?.id]);

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && !selectedJob && jobs.length > 0) {
      const job = jobs.find(j => j.id === jobId);
      if (job) selectJob(job);
    }
  }, [searchParams, jobs]);

  const selectJob = (job: Job) => {
    setSelectedJob(job);
    setState({ company: null, signals: null, alignment: null, behavioral: null, technical: null });
    setMockCompleted(false);
    generateCompany(job);
    generateSignals(job);
    generateAlignment(job);
    generateBehavioral(job);
    generateTechnical(job);
  };

  const parseJSON = (raw: string) => {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  };

  const generateCompany = async (job: Job) => {
    setLoading(p => ({ ...p, company: true }));
    try {
      const raw = await callAI(`Company research analyst. Return ONLY valid JSON. Research ${job.company} for a candidate interviewing for ${job.title}.

Return: {
  "companyOverview":"what the company does (2-3 sentences)",
  "businessModel":"how they make money",
  "revenueStreams":"key revenue streams",
  "recentNews":["3 recent developments or news items"],
  "productLaunches":["recent product launches or features"],
  "aiDirection":"their AI/technology strategy",
  "competitiveLandscape":"key competitors and positioning",
  "roleContext":"how this role fits into the org",
  "whyHiring":"why they are likely hiring for this role",
  "talkingPoints":["5 insights the candidate should mention in interviews"]
}`, 2000, "interview");
      setState(p => ({ ...p, company: parseJSON(raw) }));
    } catch (e) { console.error("Company gen failed:", e); }
    setLoading(p => ({ ...p, company: false }));
  };

  const generateSignals = async (job: Job) => {
    setLoading(p => ({ ...p, signals: true }));
    try {
      const raw = await callAI(`Hiring signal analyst. Return ONLY valid JSON. Analyze this JD for ${job.title} at ${job.company}.

JD: ${job.description || job.snippet || "No description available"}

Return: {
  "coreSkills":["core skills required"],
  "hiddenSignals":["hidden hiring signals from the JD language"],
  "technologies":["technologies mentioned or implied"],
  "leadershipExpectations":["leadership expectations"],
  "crossFunctional":["cross-functional expectations"],
  "mustDemonstrate":["things candidate MUST demonstrate"],
  "niceToDemonstrate":["nice to have demonstrations"],
  "redFlags":["potential red flags or traps to avoid"]
}`, 1500, "interview");
      setState(p => ({ ...p, signals: parseJSON(raw) }));
    } catch (e) { console.error("Signals gen failed:", e); }
    setLoading(p => ({ ...p, signals: false }));
  };

  const generateAlignment = async (job: Job) => {
    setLoading(p => ({ ...p, alignment: true }));
    try {
      const raw = await callAI(`ATS resume analyst. Return ONLY valid JSON. Compare this resume against the JD.

RESUME: ${resumeText}
JD: ${job.title} at ${job.company} — ${job.description || job.snippet || "No description available"}

Return: {
  "strongMatches":["3-4 strong matches between resume and JD"],
  "weakAreas":["3-4 weak areas or missing signals"],
  "improvedBullets":[{"original":"original bullet from resume","improved":"rewritten bullet tailored to this role","why":"why this is better"}]
}
Include exactly 3 improved bullets.`, 2000, "interview");
      setState(p => ({ ...p, alignment: parseJSON(raw) }));
    } catch (e) { console.error("Alignment gen failed:", e); }
    setLoading(p => ({ ...p, alignment: false }));
  };

  const generateBehavioral = async (job: Job) => {
    setLoading(p => ({ ...p, behavioral: true }));
    try {
      const raw = await callAI(`Expert behavioral interview coach. Return ONLY valid JSON. Generate STAR prompts for ${job.title} at ${job.company}.

Candidate resume: ${resumeText.slice(0, 800)}
JD: ${job.description}

Return: {"questions":[{"scenario":"short category label","question":"the behavioral question","whyAsked":"why interviewers ask this","strongAnswer":"what a strong answer looks like","suggestedAngle":"suggested personal story angle based on the candidate resume"}]}
Include exactly 5 questions covering: ambiguous programs, stakeholder conflict, large-scale initiatives, handling failures, cross-functional leadership.`, 3000, "interview");
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, behavioral: parsed.questions || parsed }));
    } catch (e) { console.error("Behavioral gen failed:", e); }
    setLoading(p => ({ ...p, behavioral: false }));
  };

  const generateTechnical = async (job: Job) => {
    setLoading(p => ({ ...p, technical: true }));
    try {
      const raw = await callAI(`Expert technical interviewer. Return ONLY valid JSON. Generate role-specific technical/domain questions for ${job.title} at ${job.company}.

JD: ${job.description}

Return: {"questions":[{"category":"category name","question":"the question","whatTheyTest":"what the interviewer is evaluating","frameworks":"key frameworks or models to use","answerStructure":"suggested answer structure"}]}
Include 6 questions across categories like: system design, infrastructure, program execution, technical tradeoffs, domain knowledge, estimation.`, 2500, "interview");
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, technical: parsed.questions || parsed }));
    } catch (e) { console.error("Technical gen failed:", e); }
    setLoading(p => ({ ...p, technical: false }));
  };

  const anyLoading = Object.values(loading).some(Boolean);
  const loadedCount = [state.company, state.signals, state.alignment, state.behavioral, state.technical].filter(Boolean).length;

  if (selectedJob) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-10 animate-fade-up">
        <button
          onClick={() => setSelectedJob(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1"
        >
          ← All roles
        </button>

        <div className="apple-card p-5 mb-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-foreground rounded-xl flex items-center justify-center shrink-0">
            <span className="text-background text-xs font-bold">{initials(selectedJob.company)}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{selectedJob.title}</h1>
            <p className="text-xs text-muted-foreground">{selectedJob.company} · {selectedJob.location}</p>
          </div>
          {anyLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PrepSpinner size={14} />
              <span>Building prep plan… ({loadedCount}/5)</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionShell number={1} title="Company Deep Dive" subtitle="Strategic context, news, and talking points" icon="🏢" defaultOpen={true}>
            <CompanyDeepDive data={state.company} loading={loading.company} />
          </SectionShell>

          <SectionShell number={2} title="Hiring Signal Analysis" subtitle="What the interviewer is actually testing" icon="🔍">
            <HiringSignals data={state.signals} loading={loading.signals} />
          </SectionShell>

          <SectionShell number={3} title="Resume Alignment" subtitle="Strengths, gaps, and improved bullets" icon="📄">
            <ResumeAlignment data={state.alignment} loading={loading.alignment} />
          </SectionShell>

          <SectionShell number={4} title="Behavioral Interview Preparation" subtitle="STAR prompts tailored to your background" icon="🎯" badge={`${state.behavioral?.length || 0} questions`}>
            <BehavioralPrep data={state.behavioral} loading={loading.behavioral} jobTitle={selectedJob.title} />
          </SectionShell>

          <SectionShell number={5} title="Technical / Domain Preparation" subtitle="Role-specific questions with frameworks" icon="⚙️" badge={`${state.technical?.length || 0} questions`}>
            <TechnicalPrep data={state.technical} loading={loading.technical} jobTitle={selectedJob.title} />
          </SectionShell>

          <SectionShell number={6} title="Mock Interview Simulator" subtitle="Practice with an AI interviewer — 5 questions, then scored" icon="🎙️">
            <MockInterview
              jobTitle={selectedJob.title}
              company={selectedJob.company}
              jobDescription={selectedJob.description}
              resumeText={resumeText}
            />
          </SectionShell>

          <SectionShell number={7} title="Interview Readiness Score" subtitle="Your preparation checklist and confidence level" icon="📊" defaultOpen={true}>
            <ReadinessScore
              companyLoaded={!!state.company}
              signalsLoaded={!!state.signals}
              alignmentLoaded={!!state.alignment}
              behavioralAnswered={0}
              behavioralTotal={state.behavioral?.length || 0}
              technicalAnswered={0}
              technicalTotal={state.technical?.length || 0}
              mockCompleted={mockCompleted}
            />
          </SectionShell>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Interview Preparation</h1>
      <p className="text-xs text-muted-foreground mb-6">Select a role to build your end-to-end preparation plan — company research, signal analysis, behavioral & technical prep, and mock interviews. <AIQuotaBadge feature="interview" /></p>
      <GroupedJobList
        jobs={jobs}
        onSelect={selectJob}
        ctaLabel="Prep →"
        getStatus={job => appStatuses[job.id] ?? "not_applied"}
        statusLabels={{
          not_applied: "Not applied yet",
          applied: "Applied",
          screening: "Screening",
          interview: "Interview",
          offer: "Offer",
          rejected: "Rejected",
        }}
      />
    </div>
  );
};

export default InterviewPrep;
