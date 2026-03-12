import { useState } from "react";
import { callAI } from "@/lib/ai";
import PrepSpinner from "@/components/prep/PrepSpinner";
import { toast } from "sonner";

export interface OutreachMessage {
  category: string;
  persona: string;
  message: string;
}

interface Props {
  data: OutreachMessage[] | null;
  loading: boolean;
  jobTitle: string;
  company: string;
}

const OutreachMessages = ({ data, loading, jobTitle, company }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [messages, setMessages] = useState<OutreachMessage[] | null>(null);

  const displayData = messages || data;

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  const startEdit = (idx: number) => {
    if (!displayData) return;
    setEditIdx(idx);
    setEditText(displayData[idx].message);
  };

  const saveEdit = (idx: number) => {
    if (!displayData) return;
    const updated = [...displayData];
    updated[idx] = { ...updated[idx], message: editText };
    setMessages(updated);
    setEditIdx(null);
  };

  const regenerate = async (idx: number) => {
    if (!displayData) return;
    setRegenIdx(idx);
    const m = displayData[idx];
    try {
      const raw = await callAI(`Write a personalized networking outreach message for a candidate applying to ${jobTitle} at ${company}.
Target: ${m.persona} (${m.category})
Candidate: Job seeker with relevant experience.
Tone: warm, professional, concise. 4-5 sentences. Include a specific ask. Do NOT include subject line, just the message body.`, 300, "networking");
      const updated = [...displayData];
      updated[idx] = { ...updated[idx], message: raw };
      setMessages(updated);
    } catch { toast.error("Regeneration failed"); }
    setRegenIdx(null);
  };

  if (loading) return <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Crafting outreach messages…" /></div>;
  if (!displayData) return <p className="text-xs text-muted-foreground">No data yet.</p>;

  const categories = [...new Set(displayData.map(m => m.category))];

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        <div key={cat}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{cat}</div>
          <div className="space-y-2">
            {displayData.filter(m => m.category === cat).map((m, i) => {
              const globalIdx = displayData.indexOf(m);
              const isEditing = editIdx === globalIdx;
              return (
                <div key={i} className="bg-secondary border border-border rounded-xl p-4">
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">{m.persona}</div>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg p-3 text-xs min-h-[120px] outline-none leading-relaxed resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveEdit(globalIdx)} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold">Save</button>
                        <button onClick={() => setEditIdx(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs leading-relaxed whitespace-pre-line mb-3">{m.message}</p>
                      <div className="flex gap-2">
                        <button onClick={() => copy(m.message)} className="bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors">📋 Copy</button>
                        <button onClick={() => startEdit(globalIdx)} className="bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors">✏️ Edit</button>
                        <button onClick={() => regenerate(globalIdx)} disabled={regenIdx === globalIdx} className="bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-40">
                          {regenIdx === globalIdx ? "Regenerating…" : "🔄 Regenerate"}
                        </button>
                      </div>
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

export default OutreachMessages;
