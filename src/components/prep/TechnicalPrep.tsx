import { useState } from "react";
import { callAI } from "@/lib/ai";
import PrepSpinner from "./PrepSpinner";

export interface TechnicalQuestion {
  category: string;
  question: string;
  whatTheyTest: string;
  frameworks: string;
  answerStructure: string;
}

interface Props {
  data: TechnicalQuestion[] | null;
  loading: boolean;
  jobTitle: string;
}

const TechnicalPrep = ({ data, loading, jobTitle }: Props) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [fbLoading, setFbLoading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const getReview = async (idx: number, question: string, answer: string) => {
    setFbLoading(idx);
    try {
      const fb = await callAI(`Expert technical interviewer. Review this answer. Be specific.
Role: ${jobTitle}
Question: ${question}
Answer: ${answer}

Evaluate: depth, structure, relevance. Provide 2-3 sentences of feedback and suggest improvements.`, 600, "interview");
      setFeedback(prev => ({ ...prev, [idx]: fb }));
    } catch {
      setFeedback(prev => ({ ...prev, [idx]: "Could not generate feedback." }));
    }
    setFbLoading(null);
  };

  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Generating technical questions…" /></div>;
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  const categories = [...new Set(data.map(q => q.category))];

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        <div key={cat}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{cat}</div>
          <div className="space-y-2">
            {data.filter(q => q.category === cat).map((q, i) => {
              const globalIdx = data.indexOf(q);
              const isOpen = expanded === globalIdx;
              return (
                <div key={i} className={`border rounded-lg transition-all ${isOpen ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <button onClick={() => setExpanded(isOpen ? null : globalIdx)} className="w-full text-left px-4 py-3 flex items-start gap-2">
                    <span className="text-xs font-medium flex-1">{q.question}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="bg-card border border-border rounded-lg p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">What They're Testing</div>
                          <p className="text-xs leading-relaxed">{q.whatTheyTest}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Key Frameworks</div>
                          <p className="text-xs leading-relaxed">{q.frameworks}</p>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Answer Structure</div>
                          <p className="text-xs leading-relaxed">{q.answerStructure}</p>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Practice Answer</div>
                        <textarea
                          value={answers[globalIdx] || ""}
                          onChange={e => setAnswers(prev => ({ ...prev, [globalIdx]: e.target.value }))}
                          placeholder="Write your answer…"
                          className="w-full bg-card border border-border rounded-lg p-3 text-xs min-h-[100px] outline-none leading-relaxed resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                        />
                        <button
                          onClick={() => getReview(globalIdx, q.question, answers[globalIdx] || "")}
                          disabled={!answers[globalIdx]?.trim() || fbLoading === globalIdx}
                          className="mt-2 bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                        >
                          {fbLoading === globalIdx ? "Reviewing…" : "Get AI Review"}
                        </button>
                      </div>

                      {feedback[globalIdx] && (
                        <div className="bg-card border border-primary/20 rounded-lg p-3 animate-in fade-in duration-300">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">AI Review</div>
                          <p className="text-xs leading-relaxed whitespace-pre-line">{feedback[globalIdx]}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TechnicalPrep;
