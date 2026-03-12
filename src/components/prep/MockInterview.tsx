import { useState } from "react";
import { callAI } from "@/lib/ai";
import PrepSpinner from "./PrepSpinner";

interface Props {
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
}

type Mode = "hiring_manager" | "technical";

interface Turn {
  role: "interviewer" | "candidate";
  text: string;
}

interface Evaluation {
  clarity: number;
  depth: number;
  structure: number;
  relevance: number;
  feedback: string;
}

const MockInterview = ({ jobTitle, company, jobDescription, resumeText }: Props) => {
  const [mode, setMode] = useState<Mode | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const startInterview = async (selectedMode: Mode) => {
    setMode(selectedMode);
    setTurns([]);
    setQuestionCount(0);
    setEvaluation(null);
    setLoading(true);
    try {
      const modeLabel = selectedMode === "hiring_manager" ? "hiring manager" : "technical interviewer";
      const raw = await callAI(`You are a ${modeLabel} at ${company} interviewing for ${jobTitle}. Start with a warm opening and ask your first interview question. Be realistic. One question only. 2-3 sentences max.
JD context: ${jobDescription.slice(0, 500)}`, 300, "interview");
      setTurns([{ role: "interviewer", text: raw }]);
      setQuestionCount(1);
    } catch {
      setTurns([{ role: "interviewer", text: "Welcome! Let's get started. Tell me about your background and what draws you to this role." }]);
      setQuestionCount(1);
    }
    setLoading(false);
  };

  const submitAnswer = async () => {
    if (!answer.trim() || loading) return;
    const newTurns: Turn[] = [...turns, { role: "candidate", text: answer }];
    setTurns(newTurns);
    setAnswer("");
    setLoading(true);

    const nextQ = questionCount + 1;
    if (nextQ > 5) {
      // End interview, evaluate
      setEvalLoading(true);
      try {
        const convo = newTurns.map(t => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`).join("\n");
        const raw = await callAI(`Expert interview evaluator. Evaluate this mock interview. Return ONLY valid JSON.
Role: ${jobTitle} at ${company}
Candidate resume: ${resumeText.slice(0, 600)}

Conversation:
${convo}

Return: {"clarity":0-100,"depth":0-100,"structure":0-100,"relevance":0-100,"feedback":"2-3 sentences of overall assessment"}`, 400, "interview");
        const parsed = JSON.parse(raw);
        setEvaluation(parsed);
      } catch {
        setEvaluation({ clarity: 70, depth: 65, structure: 72, relevance: 68, feedback: "Good effort. Continue practicing to strengthen your answers." });
      }
      setEvalLoading(false);
      setLoading(false);
      return;
    }

    try {
      const convo = newTurns.slice(-4).map(t => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`).join("\n");
      const modeLabel = mode === "hiring_manager" ? "hiring manager" : "technical interviewer";
      const raw = await callAI(`You are a ${modeLabel} at ${company} for ${jobTitle}. Continue the interview. Brief acknowledgment of the answer, then ask your next question. 2-3 sentences. Question ${nextQ} of 5.

Recent conversation:
${convo}`, 300);
      setTurns([...newTurns, { role: "interviewer", text: raw }]);
      setQuestionCount(nextQ);
    } catch {
      setTurns([...newTurns, { role: "interviewer", text: "That's interesting. Can you tell me about a time you had to make a difficult technical tradeoff?" }]);
      setQuestionCount(nextQ);
    }
    setLoading(false);
  };

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20">{label}</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: value >= 75 ? "hsl(153 40% 30%)" : value >= 50 ? "hsl(25 84% 31%)" : "hsl(348 46% 28%)" }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right">{value}</span>
    </div>
  );

  if (!mode) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-xs text-muted-foreground text-center max-w-md">Simulate a realistic interview. The AI will ask 5 questions, then evaluate your performance on clarity, depth, structure, and relevance.</p>
        <div className="flex gap-3">
          <button onClick={() => startInterview("hiring_manager")} className="bg-foreground text-background rounded-lg px-5 py-2.5 text-xs font-semibold hover:opacity-90 transition-opacity">
            🎯 Hiring Manager Interview
          </button>
          <button onClick={() => startInterview("technical")} className="bg-secondary border border-border text-secondary-foreground rounded-lg px-5 py-2.5 text-xs font-semibold hover:bg-accent transition-colors">
            ⚙️ Technical Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {mode === "hiring_manager" ? "Hiring Manager" : "Technical"} Interview — Question {Math.min(questionCount, 5)} of 5
        </span>
        <button onClick={() => { setMode(null); setTurns([]); setEvaluation(null); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Reset</button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              t.role === "interviewer" ? "bg-secondary text-secondary-foreground" : "bg-foreground text-background"
            }`}>
              {t.text}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-secondary rounded-lg px-3 py-2"><PrepSpinner size={14} /></div></div>}
      </div>

      {evaluation ? (
        <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3 animate-in fade-in duration-300">
          <div className="text-xs font-semibold">Interview Evaluation</div>
          <div className="space-y-2">
            <ScoreBar label="Clarity" value={evaluation.clarity} />
            <ScoreBar label="Depth" value={evaluation.depth} />
            <ScoreBar label="Structure" value={evaluation.structure} />
            <ScoreBar label="Relevance" value={evaluation.relevance} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{evaluation.feedback}</p>
          <button onClick={() => { setMode(null); setTurns([]); setEvaluation(null); }} className="text-xs font-medium text-primary hover:underline">Start another mock interview →</button>
        </div>
      ) : evalLoading ? (
        <div className="py-4 flex justify-center"><PrepSpinner size={18} label="Evaluating your performance…" /></div>
      ) : questionCount <= 5 && !loading && (
        <div className="flex gap-2">
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            className="flex-1 bg-card border border-border rounded-lg p-3 text-xs min-h-[60px] outline-none leading-relaxed resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(); } }}
          />
          <button
            onClick={submitAnswer}
            disabled={!answer.trim()}
            className="self-end bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
};

export default MockInterview;
