import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { callAI } from "@/lib/ai";
import { INITIAL_JOBS, type Job } from "@/data/seed";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-border border-t-foreground rounded-full animate-spin" style={{ width: size, height: size }} />
);

interface QItem { q: string; hint: string }
interface PrepData {
  behavioralQuestions?: QItem[];
  technicalQuestions?: QItem[];
  productQuestions?: QItem[];
  caseQuestion?: QItem;
  mustKnow?: string[];
  error?: boolean;
}

const InterviewPrep = () => {
  const [searchParams] = useSearchParams();
  const [prepJob, setPrepJob] = useState<Job | null>(null);
  const [prepResult, setPrepResult] = useState<Record<number, PrepData>>({});
  const [prepLoading, setPrepLoading] = useState<number | null>(null);
  const [activeQ, setActiveQ] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [fbLoading, setFbLoading] = useState<string | null>(null);

  // Auto-select job from URL param
  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && !prepJob) {
      const job = INITIAL_JOBS.find(j => j.id === Number(jobId));
      if (job) {
        setPrepJob(job);
        if (!prepResult[job.id]) generatePrep(job);
      }
    }
  }, [searchParams]);

  const generatePrep = async (job: Job) => {
    setPrepLoading(job.id);
    try {
      const raw = await callAI(`Expert PM interview coach. Return ONLY valid JSON.
Candidate: Sanjana Ravikumar — PM at Tesla GenAI, PMP, 4+ years, 0→1 AI products.
Role: ${job.title} at ${job.company}
JD: ${job.description}

Return: {
  "behavioralQuestions": [{"q":"question","hint":"what they really want to hear, given Sanjana's background"}],
  "technicalQuestions":  [{"q":"question","hint":"hint"}],
  "productQuestions":    [{"q":"question","hint":"hint"}],
  "caseQuestion":        {"q":"full case prompt tailored to this role","hint":"framework to use"},
  "mustKnow":            ["5 things to know about ${job.company}'s product/strategy before this interview"]
}
Include 3 questions per category.`, 3000);
      const parsed = JSON.parse(raw);
      setPrepResult(prev => ({ ...prev, [job.id]: parsed }));
    } catch (err) {
      console.error("Interview prep parse error:", err);
      setPrepResult(prev => ({ ...prev, [job.id]: { error: true } }));
    }
    setPrepLoading(null);
  };

  const getFeedback = async (question: string, answer: string, jobTitle: string) => {
    const key = question.slice(0, 30);
    setFbLoading(key);
    try {
      const fb = await callAI(`PM interview coach. Give honest, direct feedback on this answer. 3-5 sentences. Call out what's strong and what's weak. Be specific.
Role: ${jobTitle}
Question: ${question}
Candidate's answer: ${answer}
Feedback:`, 400);
      setFeedback(prev => ({ ...prev, [key]: fb }));
    } catch { setFeedback(prev => ({ ...prev, [key]: "Could not generate feedback." })); }
    setFbLoading(null);
  };

  if (prepJob) {
    const p = prepResult[prepJob.id];
    const sections: [string, QItem[] | undefined, string, string, string][] = [
      ["Behavioral", p?.behavioralQuestions, "hsl(153 40% 30%)", "hsl(150 38% 96%)", "hsl(152 34% 82%)"],
      ["Technical", p?.technicalQuestions, "hsl(226 71% 48%)", "hsl(214 100% 97%)", "hsl(213 93% 87%)"],
      ["Product", p?.productQuestions, "hsl(25 84% 31%)", "hsl(37 60% 97%)", "hsl(37 40% 80%)"],
    ];

    return (
      <div className="max-w-[880px] mx-auto p-7 animate-fade-up">
        <button onClick={() => { setPrepJob(null); setActiveQ(null); setUserAnswer(""); }} className="bg-transparent border border-border text-muted-foreground rounded-[6px] px-3 py-1 text-xs mb-5 hover:text-foreground transition-colors">
          ← All roles
        </button>

        {prepLoading === prepJob.id ? (
          <div className="text-center py-12 bg-card border border-border rounded-[11px]">
            <Spinner size={20} />
            <p className="animate-pulse-dot text-xs text-muted-foreground mt-3">Building your personalized interview guide…</p>
          </div>
        ) : p?.error ? (
          <div className="text-xs text-muted-foreground">Failed — retry.</div>
        ) : p ? (
          <div className="flex flex-col gap-3.5">
            {p.mustKnow && (
              <div className="bg-card border border-border rounded-[11px] p-4">
                <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2.5">Must Know Before This Interview</div>
                {p.mustKnow.map((item, i) => (
                  <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed"><span className="font-bold shrink-0">{i + 1}.</span>{item}</div>
                ))}
              </div>
            )}
            {sections.map(([title, qs, color, bg, border]) => (
              <div key={title} className="bg-card border border-border rounded-[11px] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color }}>{title} Questions</div>
                {qs?.map((item, i) => {
                  const qKey = item.q.slice(0, 30);
                  const isActive = activeQ === qKey;
                  return (
                    <div key={i} className="mb-2.5 rounded-lg transition-colors" style={{ background: isActive ? bg : "transparent", border: isActive ? `1px solid ${border}` : "1px solid transparent", padding: isActive ? 14 : 0 }}>
                      <div
                        className="flex items-start justify-between gap-2.5 cursor-pointer"
                        style={{ padding: isActive ? 0 : "10px 0", borderBottom: !isActive ? "1px solid hsl(var(--border))" : "none" }}
                        onClick={() => { setActiveQ(isActive ? null : qKey); setUserAnswer(""); }}
                      >
                        <span className="text-xs font-medium leading-relaxed">{item.q}</span>
                        <span className="text-[11px] shrink-0 mt-0.5" style={{ color }}>{isActive ? "▲" : "▼"}</span>
                      </div>
                      {isActive && (
                        <div className="animate-fade-up mt-2.5">
                          <div className="text-[11.5px] italic mb-2.5" style={{ color }}>💡 {item.hint}</div>
                          <textarea
                            value={userAnswer}
                            onChange={e => setUserAnswer(e.target.value)}
                            placeholder="Type your answer to get AI feedback…"
                            className="w-full bg-card border border-border rounded-[6px] p-2.5 text-xs min-h-[100px] outline-none leading-relaxed resize-y"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => getFeedback(item.q, userAnswer, prepJob.title)}
                              disabled={!userAnswer.trim() || fbLoading === qKey}
                              className="bg-foreground text-background rounded-[6px] px-3 py-1 text-xs font-semibold disabled:opacity-40"
                            >
                              {fbLoading === qKey ? "Getting feedback…" : "Get AI Feedback"}
                            </button>
                          </div>
                          {feedback[qKey] && (
                            <div className="animate-fade-up mt-2.5 bg-card border border-border rounded-lg p-3">
                              <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2">Feedback</div>
                              <p className="text-xs leading-relaxed">{feedback[qKey]}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {p.caseQuestion && (
              <div className="bg-card border border-border rounded-[11px] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "hsl(348 46% 28%)" }}>Case Question</div>
                <p className="text-xs font-medium leading-relaxed mb-2">{p.caseQuestion.q}</p>
                <p className="text-xs italic" style={{ color: "hsl(348 46% 28%)" }}>Framework: {p.caseQuestion.hint}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-[880px] mx-auto p-7 pt-9">
      <h1 className="font-serif text-[26px] font-normal mb-1">Interview Prep</h1>
      <p className="text-xs text-muted-foreground mb-5">AI-generated questions tailored to the exact JD and your background — practice with live feedback</p>
      <div className="flex flex-col gap-1.5">
        {INITIAL_JOBS.map(job => (
          <div
            key={job.id}
            onClick={() => { setPrepJob(job); if (!prepResult[job.id]) generatePrep(job); }}
            className="bg-card border border-border rounded-[9px] p-4 flex items-center justify-between cursor-pointer hover:shadow-sm hover:-translate-y-px transition-all"
          >
            <div>
              <div className="text-sm font-semibold mb-0.5">{job.title}</div>
              <div className="text-xs text-muted-foreground">{job.company} · {job.location}</div>
            </div>
            <span className="text-xs text-muted-foreground">Prep this role →</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterviewPrep;
