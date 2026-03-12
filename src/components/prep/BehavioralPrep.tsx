import { useState } from "react";
import { callAI } from "@/lib/ai";
import PrepSpinner from "./PrepSpinner";

export interface BehavioralQuestion {
  scenario: string;
  question: string;
  whyAsked: string;
  strongAnswer: string;
  suggestedAngle: string;
}

interface Props {
  data: BehavioralQuestion[] | null;
  loading: boolean;
  jobTitle: string;
}

const BehavioralPrep = ({ data, loading, jobTitle }: Props) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [fbLoading, setFbLoading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const improveAnswer = async (idx: number, question: string, answer: string) => {
    setFbLoading(idx);
    try {
      const fb = await callAI(`Expert interview coach. Evaluate this STAR answer. Be specific and actionable.
Role: ${jobTitle}
Question: ${question}
Answer: ${answer}

Provide:
1. What's strong about this answer (1-2 sentences)
2. What's missing or weak (1-2 sentences)
3. A rewritten, stronger version of the answer using STAR format (3-4 sentences)`, 800, "interview");
      setFeedback(prev => ({ ...prev, [idx]: fb }));
    } catch {
      setFeedback(prev => ({ ...prev, [idx]: "Could not generate feedback." }));
    }
    setFbLoading(null);
  };

  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Generating STAR prompts…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  return (
    <div className="space-y-2">
      {data.map((q, idx) => {
        const isOpen = expanded === idx;
        return (
          <div key={idx} className={`border rounded-lg transition-all ${isOpen ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <button
              onClick={() => setExpanded(isOpen ? null : idx)}
              className="w-full text-left px-4 py-3 flex items-start gap-3"
            >
              <span className="text-[10px] font-bold bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 mt-0.5 shrink-0">{q.scenario}</span>
              <span className="text-xs font-medium flex-1">{q.question}</span>
              <span className="text-muted-foreground text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Why They Ask This</div>
                    <p className="text-xs leading-relaxed">{q.whyAsked}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">What a Strong Answer Looks Like</div>
                    <p className="text-xs leading-relaxed">{q.strongAnswer}</p>
                  </div>
                </div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">💡 Suggested Story Angle</div>
                  <p className="text-xs leading-relaxed italic">{q.suggestedAngle}</p>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your Answer</div>
                  <textarea
                    value={answers[idx] || ""}
                    onChange={e => setAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="Write your STAR answer here…"
                    className="w-full bg-card border border-border rounded-lg p-3 text-xs min-h-[120px] outline-none leading-relaxed resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                  <button
                    onClick={() => improveAnswer(idx, q.question, answers[idx] || "")}
                    disabled={!answers[idx]?.trim() || fbLoading === idx}
                    className="mt-2 bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {fbLoading === idx ? "Improving…" : "✨ Improve My Answer with AI"}
                  </button>
                </div>

                {feedback[idx] && (
                  <div className="bg-card border border-primary/20 rounded-lg p-3 animate-in fade-in duration-300">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">AI Feedback</div>
                    <p className="text-xs leading-relaxed whitespace-pre-line">{feedback[idx]}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BehavioralPrep;
