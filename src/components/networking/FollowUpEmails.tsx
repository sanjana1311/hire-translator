import { useState } from "react";
import { callAI } from "@/lib/ai";
import { toast } from "sonner";
import PrepSpinner from "@/components/prep/PrepSpinner";

interface Props {
  jobTitle: string;
  company: string;
  appliedDate?: string;
  userName: string;
}

type FollowUpType = "application" | "networking" | "thank_you";

const typeConfig: Record<FollowUpType, { label: string; icon: string; description: string }> = {
  application: { label: "Application Follow-Up", icon: "📨", description: "Follow up on a submitted application" },
  networking: { label: "Networking Follow-Up", icon: "🤝", description: "Reconnect after a networking conversation" },
  thank_you: { label: "Interview Thank-You", icon: "🙏", description: "Thank your interviewer after a round" },
};

const FollowUpEmails = ({ jobTitle, company, appliedDate, userName }: Props) => {
  const [selectedType, setSelectedType] = useState<FollowUpType | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  const generate = async (type: FollowUpType) => {
    setSelectedType(type);
    setLoading(true);
    setEmail("");
    setEditing(false);

    const prompts: Record<FollowUpType, string> = {
      application: `Write a professional follow-up email from a candidate (${userName}) who applied for ${jobTitle} at ${company}${appliedDate ? ` on ${appliedDate}` : ""}. 
The email should:
- Be written from the CANDIDATE's perspective (they are following up on their own application)
- Reference their relevant experience
- Be warm, professional, concise (4-5 sentences)
- Include a specific ask for status update
- Do NOT include subject line, just the body. Start with "Hi [Name],"
- Sign off with "${userName}"`,
      networking: `Write a professional networking follow-up email from ${userName} after having a conversation with someone at ${company} about the ${jobTitle} role.
The email should:
- Be written from the CANDIDATE's perspective
- Thank them for the conversation
- Reference a specific topic discussed (make it plausible)
- Keep it warm and brief (3-4 sentences)
- Do NOT include subject line. Start with "Hi [Name],"
- Sign off with "${userName}"`,
      thank_you: `Write a professional thank-you email from ${userName} after an interview for ${jobTitle} at ${company}.
The email should:
- Be written from the CANDIDATE's perspective
- Reference specific topics from the interview (make plausible for this role)
- Express enthusiasm without being desperate
- Brief (4-5 sentences)
- Do NOT include subject line. Start with "Hi [Name],"
- Sign off with "${userName}"`,
    };

    try {
      const raw = await callAI(prompts[type], 400);
      setEmail(raw);
    } catch {
      setEmail("Could not generate email. Please try again.");
    }
    setLoading(false);
  };

  const regenerate = async () => {
    if (selectedType) await generate(selectedType);
  };

  // Timing recommendations
  const getTimingTip = (type: FollowUpType): string => {
    switch (type) {
      case "application": return "Best sent 7–10 days after applying";
      case "networking": return "Best sent 5–7 days after your conversation";
      case "thank_you": return "Best sent within 24 hours of your interview";
    }
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {(Object.entries(typeConfig) as [FollowUpType, typeof typeConfig[FollowUpType]][]).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => generate(type)}
            className={`rounded-xl p-3 text-left border transition-all ${
              selectedType === type ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border hover:border-primary/20 hover:bg-accent/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{cfg.icon}</span>
              <span className="text-xs font-semibold">{cfg.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{cfg.description}</p>
          </button>
        ))}
      </div>

      {/* Email output */}
      {loading && <div className="py-8 flex justify-center"><PrepSpinner size={18} label="Writing your email…" /></div>}

      {email && !loading && selectedType && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{typeConfig[selectedType].icon}</span>
              <span className="text-xs font-semibold">{typeConfig[selectedType].label}</span>
            </div>
            <span className="text-[10px] text-muted-foreground italic">{getTimingTip(selectedType)}</span>
          </div>

          {editing ? (
            <div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg p-3 text-xs min-h-[180px] outline-none leading-relaxed resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setEmail(editText); setEditing(false); }} className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold">Save</button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs leading-relaxed whitespace-pre-line">{email}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => copy(email)} className="bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity">📋 Copy Email</button>
            <button onClick={() => { setEditText(email); setEditing(true); }} className="bg-secondary border border-border text-secondary-foreground rounded-lg px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">✏️ Edit</button>
            <button onClick={regenerate} className="bg-secondary border border-border text-secondary-foreground rounded-lg px-4 py-2 text-xs font-medium hover:bg-accent transition-colors">🔄 Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpEmails;
