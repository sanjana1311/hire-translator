import { useState } from "react";
import { callAI } from "@/lib/ai";
import { INITIAL_APPLICATIONS } from "@/data/seed";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-border border-t-foreground rounded-full animate-spin" style={{ width: size, height: size }} />
);

interface RejectionData {
  patterns?: string[];
  likelyRootCause?: string;
  titleMismatch?: string;
  quickFixes?: string[];
  deeperFixes?: string[];
  roleToTarget?: string;
  companiesToAvoid?: string;
  error?: boolean;
}

const RejectionAnalysis = () => {
  const [rejection, setRejection] = useState<RejectionData | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const apps = INITIAL_APPLICATIONS;
      const rejected = apps.filter(a => a.status === "rejected");
      const raw = await callAI(`Career strategist. Analyze rejection patterns. Return ONLY valid JSON.
Candidate: Sanjana Ravikumar — PM at Tesla GenAI, PMP, 4+ yrs, targeting senior PM/TPM at big tech.
REJECTIONS:
${rejected.map(a => `${a.company}: ${a.title}. Notes: ${a.notes}`).join("\n")}

ALL APPLICATIONS: ${apps.length} total, ${rejected.length} rejected, ${apps.filter(a => a.status === "applied").length} pending.

Return: {
  "patterns": ["3 specific patterns"],
  "likelyRootCause": "single most likely reason — be direct",
  "titleMismatch": "is Program Manager title hurting her targeting Product Manager roles?",
  "quickFixes": ["3 things she can change immediately"],
  "deeperFixes": ["2 longer-term positioning changes"],
  "roleToTarget": "what role type to target",
  "companiesToAvoid": "types of companies to avoid"
}`, 700);
      setRejection(JSON.parse(raw));
    } catch { setRejection({ error: true }); }
    setLoading(false);
  };

  return (
    <div className="max-w-[760px] mx-auto p-7 pt-9">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-serif text-[26px] font-normal mb-1">Rejection Analysis</h1>
          <p className="text-xs text-muted-foreground">{INITIAL_APPLICATIONS.filter(a => a.status === "rejected").length} rejections analyzed for patterns</p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {loading ? "Analyzing…" : rejection ? "Re-analyze" : "Analyze Rejections"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-16 bg-card border border-border rounded-[11px]">
          <Spinner size={20} />
          <p className="animate-pulse-dot text-xs text-muted-foreground mt-3.5">Finding patterns across your rejections…</p>
        </div>
      )}

      {!rejection && !loading && (
        <div className="bg-card border border-border rounded-[11px] p-12 text-center">
          <div className="font-serif text-lg italic text-muted-foreground mb-2">Turn rejections into a strategy</div>
          <p className="text-xs text-muted-foreground">Find the real reason you're being passed over — and exactly what to change</p>
        </div>
      )}

      {rejection && !rejection.error && (
        <div className="animate-fade-up flex flex-col gap-3">
          {/* Root cause */}
          <div className="rounded-[11px] p-5" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(348 46% 28%)" }}>Most Likely Root Cause</div>
            <p className="font-serif text-lg leading-snug">{rejection.likelyRootCause}</p>
          </div>
          {/* Title mismatch */}
          <div className="bg-card border border-border rounded-[11px] p-4">
            <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2.5">Title Mismatch Assessment</div>
            <p className="text-xs leading-relaxed">{rejection.titleMismatch}</p>
          </div>
          {/* Patterns + Quick fixes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-[11px] p-4">
              <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2.5">Patterns Found</div>
              {rejection.patterns?.map((p, i) => (
                <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed">
                  <span className="font-bold shrink-0">{i + 1}.</span>{p}
                </div>
              ))}
            </div>
            <div className="rounded-[11px] p-4" style={{ background: "hsl(37 60% 97%)", border: "1px solid hsl(37 40% 80%)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "hsl(25 84% 31%)" }}>Fix Immediately</div>
              {rejection.quickFixes?.map((f, i) => (
                <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed" style={{ color: "hsl(25 50% 22%)" }}>
                  <span style={{ color: "hsl(25 84% 31%)" }}>→</span>{f}
                </div>
              ))}
            </div>
          </div>
          {/* Best role + Longer term */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[11px] p-4" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(153 40% 30%)" }}>Best Role to Target</div>
              <p className="text-xs leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>{rejection.roleToTarget}</p>
            </div>
            <div className="bg-card border border-border rounded-[11px] p-4">
              <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2.5">Longer-Term Positioning</div>
              {rejection.deeperFixes?.map((f, i) => (
                <div key={i} className="flex gap-1.5 mb-2 text-xs leading-relaxed">
                  <span className="shrink-0">📌</span>{f}
                </div>
              ))}
            </div>
          </div>
          {/* Companies to avoid */}
          <div className="bg-card border border-border rounded-[9px] p-3.5">
            <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-2">Companies to Avoid</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{rejection.companiesToAvoid}</p>
          </div>
        </div>
      )}

      {rejection?.error && (
        <div className="rounded-[9px] p-4 text-xs" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)", color: "hsl(348 46% 28%)" }}>
          Could not analyze — please retry.
        </div>
      )}
    </div>
  );
};

export default RejectionAnalysis;
