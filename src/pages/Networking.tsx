import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { INITIAL_JOBS, RESUME_TEXT, initials, type Job } from "@/data/seed";
import { useProfile } from "@/hooks/use-profile";
import SectionShell from "@/components/prep/SectionShell";
import BestContacts, { type ContactTarget } from "@/components/networking/BestContacts";
import OutreachStrategy, { type StrategyTier } from "@/components/networking/OutreachStrategy";
import OutreachMessages, { type OutreachMessage } from "@/components/networking/OutreachMessages";
import SmartQuestions, { type QuestionGroup } from "@/components/networking/SmartQuestions";
import NetworkingTracker from "@/components/networking/NetworkingTracker";
import FollowUpEmails from "@/components/networking/FollowUpEmails";
import PrepSpinner from "@/components/prep/PrepSpinner";

interface NetState {
  contacts: ContactTarget[] | null;
  strategy: StrategyTier[] | null;
  messages: OutreachMessage[] | null;
  questions: QuestionGroup[] | null;
}

const Networking = () => {
  const [searchParams] = useSearchParams();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [state, setState] = useState<NetState>({ contacts: null, strategy: null, messages: null, questions: null });
  const [loading, setLoading] = useState({ contacts: false, strategy: false, messages: false, questions: false });
  const { data: profile } = useProfile();

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && !selectedJob) {
      const job = INITIAL_JOBS.find(j => j.id === Number(jobId));
      if (job) selectJob(job);
    }
  }, [searchParams]);

  const selectJob = (job: Job) => {
    setSelectedJob(job);
    setState({ contacts: null, strategy: null, messages: null, questions: null });
    generateContacts(job);
    generateStrategy(job);
    generateMessages(job);
    generateQuestions(job);
  };

  const parseJSON = (raw: string) => JSON.parse(raw.replace(/```json|```/g, "").trim());

  const generateContacts = async (job: Job) => {
    setLoading(p => ({ ...p, contacts: true }));
    try {
      const raw = await callAI(`Networking strategist. Return ONLY valid JSON. Candidate: Sanjana Ravikumar, PM at Tesla GenAI, PMP, ASU MS Engineering Management. Previously at Intellipaat, Infineon.
Target: ${job.title} at ${job.company}.

Generate 4 networking target categories prioritized by response rate.
Return: {"targets":[{"category":"School Alumni","title":"ASU alumni at ${job.company}","description":"why and how this helps","searchTip":"LinkedIn search tip","outreachGoal":"specific goal for this outreach"},{"category":"Previous Company Alumni","title":"...","description":"...","searchTip":"...","outreachGoal":"..."},{"category":"Role Holders","title":"...","description":"...","searchTip":"...","outreachGoal":"..."},{"category":"Hiring Team","title":"...","description":"...","searchTip":"...","outreachGoal":"..."}]}`, 1500);
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, contacts: parsed.targets || parsed }));
    } catch (e) { console.error("Contacts gen failed:", e); }
    setLoading(p => ({ ...p, contacts: false }));
  };

  const generateStrategy = async (job: Job) => {
    setLoading(p => ({ ...p, strategy: true }));
    try {
      const raw = await callAI(`Networking strategist. Return ONLY valid JSON. For ${job.title} at ${job.company}, create a tiered outreach strategy.

Return: {"tiers":[{"tier":"tier name","objective":"specific objective","approach":"how to approach","expectedOutcome":"what to expect","priority":1}]}
Include 4 tiers: Alumni Outreach, Previous Company Connections, Role Holders, Hiring Team. Priority 1 is highest.`, 1200);
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, strategy: parsed.tiers || parsed }));
    } catch (e) { console.error("Strategy gen failed:", e); }
    setLoading(p => ({ ...p, strategy: false }));
  };

  const generateMessages = async (job: Job) => {
    setLoading(p => ({ ...p, messages: true }));
    try {
      const raw = await callAI(`Career networking expert. Return ONLY valid JSON. Write personalized outreach messages for ${job.title} at ${job.company}.
Candidate: Sanjana Ravikumar, PM at Tesla GenAI, PMP, ASU grad.

Generate one message per category. Each message should be warm, professional, 4-5 sentences, and include a specific ask.
Return: {"messages":[{"category":"School Alumni","persona":"ASU alum working at ${job.company}","message":"full message text starting with Hi [Name], and ending with Best, Sanjana"},{"category":"Previous Company Alumni","persona":"...","message":"..."},{"category":"Role Holders","persona":"...","message":"..."},{"category":"Hiring Team","persona":"...","message":"..."}]}`, 2000);
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, messages: parsed.messages || parsed }));
    } catch (e) { console.error("Messages gen failed:", e); }
    setLoading(p => ({ ...p, messages: false }));
  };

  const generateQuestions = async (job: Job) => {
    setLoading(p => ({ ...p, questions: true }));
    try {
      const raw = await callAI(`Networking strategist. Return ONLY valid JSON. Generate smart networking questions for someone targeting ${job.title} at ${job.company}.

Group questions by goal. Return: {"groups":[{"goal":"Understanding the Role","questions":["question 1","question 2","question 3"]},{"goal":"Understanding the Hiring Process","questions":["..."]},{"goal":"Understanding the Team","questions":["..."]}]}
3 questions per group.`, 1000);
      const parsed = parseJSON(raw);
      setState(p => ({ ...p, questions: parsed.groups || parsed }));
    } catch (e) { console.error("Questions gen failed:", e); }
    setLoading(p => ({ ...p, questions: false }));
  };

  const anyLoading = Object.values(loading).some(Boolean);
  const loadedCount = [state.contacts, state.strategy, state.messages, state.questions].filter(Boolean).length;

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
            <h1 className="font-serif text-xl font-normal">Networking Strategy</h1>
            <p className="text-xs text-muted-foreground">{selectedJob.title} · {selectedJob.company} · {selectedJob.location}</p>
          </div>
          {anyLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PrepSpinner size={14} />
              <span>Building strategy… ({loadedCount}/4)</span>
            </div>
          )}
        </div>

        {/* Pipeline indicator */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center gap-4">
          {["Apply", "Network", "Follow Up", "Interview", "Offer"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i <= 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>{i + 1}</span>
              <span className={`text-xs font-medium ${i <= 1 ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
              {i < 4 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <SectionShell number={1} title="Best People to Contact" subtitle="Prioritized networking targets by response rate" icon="👥" defaultOpen={true}>
            <BestContacts data={state.contacts} loading={loading.contacts} />
          </SectionShell>

          <SectionShell number={2} title="Outreach Strategy" subtitle="Objectives and approach for each tier" icon="🎯">
            <OutreachStrategy data={state.strategy} loading={loading.strategy} />
          </SectionShell>

          <SectionShell number={3} title="Personalized Outreach Messages" subtitle="Ready-to-send messages with copy, edit, and regenerate" icon="💬">
            <OutreachMessages data={state.messages} loading={loading.messages} jobTitle={selectedJob.title} company={selectedJob.company} />
          </SectionShell>

          <SectionShell number={4} title="Smart Questions to Ask" subtitle="Questions grouped by networking goal" icon="❓">
            <SmartQuestions data={state.questions} loading={loading.questions} />
          </SectionShell>

          <SectionShell number={5} title="Networking Tracker" subtitle="Track your outreach pipeline for this role" icon="📋">
            <NetworkingTracker jobSeedId={selectedJob.id} company={selectedJob.company} />
          </SectionShell>

          <SectionShell number={6} title="Follow-Up Emails" subtitle="Application, networking, and interview follow-ups" icon="📧">
            <FollowUpEmails
              jobTitle={selectedJob.title}
              company={selectedJob.company}
              userName={profile?.full_name || "Sanjana"}
            />
          </SectionShell>
        </div>
      </div>
    );
  }

  // Role selection
  return (
    <div className="max-w-[900px] mx-auto p-7 pt-9">
      <h1 className="font-serif text-[26px] font-normal mb-1">Networking & Follow-Up</h1>
      <p className="text-xs text-muted-foreground mb-6">Select a role to build a complete networking strategy — who to contact, what to say, and how to follow up.</p>

      {/* Pipeline overview */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Your Job Search Pipeline</div>
        <div className="flex items-center gap-3 text-xs">
          {["Apply", "Network", "Follow Up", "Interview", "Offer"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{i + 1}</span>
              <span className="text-secondary-foreground">{step}</span>
              {i < 4 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {INITIAL_JOBS.map(job => (
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
              <div className="text-xs text-muted-foreground">{job.company} · {job.location}</div>
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">Network →</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Networking;
