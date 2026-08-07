import { useState } from "react";
import { toast } from "sonner";
import {
  CONNECTION_TYPE_LABEL,
  STATUS_LABEL,
  type NetworkingTarget,
} from "@/hooks/use-networking-targets";

interface Props {
  target: NetworkingTarget;
  rank: number;
  onUpdate: (updates: Partial<NetworkingTarget> & { id: string }) => void;
}

const statusColor: Record<string, string> = {
  not_contacted: "hsl(30 5% 59%)",
  contacted: "hsl(25 84% 31%)",
  replied: "hsl(153 40% 30%)",
  follow_up_due: "hsl(226 71% 48%)",
  not_a_fit: "hsl(0 0% 55%)",
};

const TargetCard = ({ target: t, rank, onUpdate }: Props) => {
  const [notes, setNotes] = useState(t.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [message, setMessage] = useState(t.outreach_message ?? "");
  const [editingMessage, setEditingMessage] = useState(false);

  const profileLink = t.linkedin_url || t.search_url || "";

  return (
    <div className="apple-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[10px] font-bold text-secondary-foreground">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold">{t.name || CONNECTION_TYPE_LABEL[t.connection_type] || "Target contact"}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {CONNECTION_TYPE_LABEL[t.connection_type] ?? t.connection_type}
            </span>
            <span className="text-[10px] text-muted-foreground">Relevance {t.relevance}/100</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {t.headline}
            {t.target_company ? ` · ${t.target_company}` : ""}
          </div>

          <div className="bg-background border border-border rounded-lg p-2.5 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Why relevant</div>
            <p className="text-xs leading-relaxed">{t.match_reason}</p>
            {t.evidence && (
              <p className="text-[11px] text-muted-foreground mt-1">Based on: {t.evidence}</p>
            )}
          </div>

          {profileLink && (
            <a
              href={profileLink}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block text-[11px] font-medium text-primary hover:underline mb-2"
            >
              {t.linkedin_url ? "Open LinkedIn profile ↗" : "Search this person on LinkedIn ↗"}
            </a>
          )}

          <div className="bg-secondary border border-border rounded-lg p-3 mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Outreach message</div>
            {editingMessage ? (
              <>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg p-2.5 text-xs min-h-[100px] outline-none leading-relaxed resize-y"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { onUpdate({ id: t.id, outreach_message: message }); setEditingMessage(false); }}
                    className="bg-foreground text-background rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                  >
                    Save
                  </button>
                  <button onClick={() => { setMessage(t.outreach_message ?? ""); setEditingMessage(false); }} className="text-[11px] text-muted-foreground">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed whitespace-pre-line mb-2">{message || "No message generated yet."}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(message); toast.success("Message copied"); }}
                    className="bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors"
                  >
                    Copy Message
                  </button>
                  <button
                    onClick={() => setEditingMessage(true)}
                    className="bg-card border border-border text-secondary-foreground rounded-lg px-3 py-1.5 text-[11px] font-medium hover:bg-accent transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={t.status}
              onChange={e => onUpdate({ id: t.id, status: e.target.value })}
              className="bg-secondary border border-border rounded-lg px-2 py-1 text-[11px] outline-none"
              style={{ color: statusColor[t.status] }}
            >
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="text-[11px] text-muted-foreground flex items-center gap-1">
              Follow-up
              <input
                type="date"
                value={t.follow_up_date ?? ""}
                onChange={e => onUpdate({ id: t.id, follow_up_date: e.target.value || null })}
                className="bg-secondary border border-border rounded-lg px-2 py-1 text-[11px] outline-none"
              />
            </label>
          </div>

          <div className="mt-2">
            {editingNotes ? (
              <div className="flex gap-2">
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes…"
                  className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs outline-none"
                />
                <button
                  onClick={() => { onUpdate({ id: t.id, notes }); setEditingNotes(false); }}
                  className="text-[11px] font-medium text-primary"
                >
                  Save
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingNotes(true)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {t.notes ? `📝 ${t.notes}` : "+ Add notes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetCard;
