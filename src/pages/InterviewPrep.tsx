import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { RESUME_TEXT } from "@/data/seed";
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [state, setState] = useState<PrepState>({ company: null, signals: null, alignment: null, behavioral: null, technical: null });
  const [loading, setLoading] = useState({ company: false, signals: false, alignment: false, behavioral: false, technical: false });
  const [mockCompleted, setMockCompleted] = useState(false);

  // Load jobs from DB
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

  // Auto-select job from URL
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
    // Fire all generation calls in parallel
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
}`, 2000);
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
}`, 1500);
      setState(p => ({ ...p, signals: parseJSON(raw) }));
    } catch (e) { console.error("Signals gen failed:", e); }
    setLoading(p => ({ ...p, signals: false }));
  };

  const generateAlignment = async (job: Job) => {
    setLoading(p => ({ ...p, alignment: true }));
    try {
      const raw = await callAI(`ATS resume analyst. Return ONLY valid JSON. Compare this resume against the JD.

RESUME: ${RESUME_TEXT}
JD: ${job.title} at ${job.company} — ${job.description || job.snippet || "No description available"}

Return: {
  "strongMatches":["3-4 strong matches between resume and JD"],
  "weakAreas":["3-4 weak areas or missing signals"],
  "improvedBullets":[{"original":"original bullet from resume","improved":"rewritten bullet tailored to this role","why":"why this is better"}]
}
Include exactly 3 improved bullets.`, 2000);
      setState(p => ({ ...p, alignment: parseJSON(raw) }));
    } catch (e) { console.error("Alignment gen failed:", e); }
    setLoading(p => ({ ...p, alignment: false }));
  };

  const generateBehavioral = async (job: Job) => {
    setLoading(p => ({ ...p, behavioral: true }));
    try {
      const raw = await callAI(`Expert behavioral interview coach. Return ONLY valid JSON. Generate STAR prompts for ${job.title} at ${job.company}.

Candidate resume: ${RESUME_TEXT.slice(0, 800)}
JD: ${job.description}

Return: {"questions":[{"scenario":"short category label","question":"the behavioral question","whyAsked":"why interviewers ask this","strongAnswer":"what a strong answer looks like","suggestedAngle":"suggested personal story angle based on the candidate resume"}]}
Include exactly 5 questions covering: ambiguous programs, stakeholder conflict, large-scale initiatives, handling failures, cross-functional leadership.`, 3000);
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
Include 6 questions across categories like: system design, infrastructure, program execution, technical tradeoffs, domain knowledge, estimation.`, 2500);
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, technical: parsed.questions || parsed }));
    } catch (e) { console.error("Technical gen failed:", e); }
    setLoading(p => ({ ...p, technical: false }));
  };

  const anyLoading = Object.values(loading).some(Boolean);
  const loadedCount = [state.company, state.signals, state.alignment, state.behavioral, state.technical].filter(Boolean).length;

  if (selectedJob) {
    return (
      <div className="max-w-[900px] mx-auto p-7 animate-fade-up">
        <button
          onClick={() => setSelectedJob(null)}
          className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors"
        >
          ← All roles
        </button>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-5 mb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-foreground rounded-lg flex items-center justify-center shrink-0">
            <span className="text-background text-xs font-bold">{initials(selectedJob.company)}</span>
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-normal">{selectedJob.title}</h1>
            <p className="text-xs text-muted-foreground">{selectedJob.company} · {selectedJob.location}</p>
          </div>
          {anyLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PrepSpinner size={14} />
              <span>Building prep plan… ({loadedCount}/5)</span>
            </div>
          )}
        </div>

        {/* Sections */}
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
              resumeText={RESUME_TEXT}
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

  // Role selection list
  return (
    <div className="max-w-[900px] mx-auto p-7 pt-9">
      <h1 className="font-serif text-[26px] font-normal mb-1">Interview Preparation</h1>
      <p className="text-xs text-muted-foreground mb-6">Select a role to build your end-to-end preparation plan — company research, signal analysis, behavioral & technical prep, and mock interviews.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {jobs.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center col-span-2">
            <p className="text-sm text-muted-foreground">No imported jobs yet. Sync your Gmail on the Roles page to get started.</p>
          </div>
        ) : jobs.map(job => (
          <div
            key={job.id}
            onClick={() => selectJob(job)}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-background text-[10px] font-bold">{initials(job.company)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{job.title}</div>
              <div className="text-xs text-muted-foreground">{job.company} · {job.location || "Remote"}</div>
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">Prep →</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterviewPrep;
