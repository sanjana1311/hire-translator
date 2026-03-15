import { useState } from "react";
import { callAI } from "@/lib/ai";
import { AIQuotaBadge } from "@/components/AIQuotaBadge";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-foreground/10 border-t-foreground/60 rounded-full animate-spin" style={{ width: size, height: size }} />
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
  const { data: profile } = useProfile();
  const [rejection, setRejection] = useState<RejectionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rejCount, setRejCount] = useState(0);

  const analyze = async () => {
    setLoading(true);
    try {
      let allApps: { company: string; title: string; status: string; notes: string }[] = [];

      if (profile?.id) {
        const { data } = await supabase
          .from("applications")
          .select("title, company, status, notes")
          .eq("profile_id", profile.id);
        if (data && data.length > 0) {
          allApps = data.map(a => ({
            company: a.company,
            title: a.title,
            status: a.status,
            notes: a.notes || "",
          }));
        }
      }

      if (allApps.length === 0) {
        setRejection({ error: true });
        setLoading(false);
        return;
      }

      const rejected = allApps.filter(a => a.status === "rejected");
      setRejCount(rejected.length);

      if (rejected.length === 0) {
        setRejection({ error: true });
        setLoading(false);
        return;
      }

      const candidateName = profile?.full_name || "Job seeker";
      const targetRoles = profile?.target_roles || "PM/TPM roles";

      const raw = await callAI(`Career strategist. Analyze rejection patterns. Return ONLY valid JSON.
Candidate: ${candidateName} — targeting ${targetRoles}.
REJECTIONS:
${rejected.map(a => `${a.company}: ${a.title}. Notes: ${a.notes}`).join("\n")}

ALL APPLICATIONS: ${allApps.length} total, ${rejected.length} rejected, ${allApps.filter(a => a.status === "applied").length} pending.

Return: {
  "patterns": ["3 specific patterns"],
  "likelyRootCause": "single most likely reason — be direct",
  "titleMismatch": "is their current title hurting their targeting?",
  "quickFixes": ["3 things they can change immediately"],
  "deeperFixes": ["2 longer-term positioning changes"],
  "roleToTarget": "what role type to target",
  "companiesToAvoid": "types of companies to avoid"
}`, 700, "rejection");
      setRejection(JSON.parse(raw));
    } catch { setRejection({ error: true }); }
    setLoading(false);
  };

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-0.5">Rejection Analysis</h1>
          <p className="text-xs text-muted-foreground">{rejCount} rejections analyzed for patterns <AIQuotaBadge feature="rejection" /></p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-foreground text-background rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
        >
          {loading ? "Analyzing…" : rejection ? "Re-analyze" : "Analyze Rejections"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-20 apple-card">
          <Spinner size={20} />
          <p className="animate-pulse-dot text-xs text-muted-foreground mt-4">Finding patterns across your rejections…</p>
        </div>
      )}

      {!rejection && !loading && (
        <div className="apple-card p-14 text-center">
          <div className="text-xl font-semibold text-muted-foreground/60 mb-2.5">Turn rejections into a strategy</div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Find the real reason you're being passed over — and exactly what to change</p>
        </div>
      )}

      {rejection && !rejection.error && (
        <div className="animate-fade-up flex flex-col gap-3">
          <div className="rounded-xl p-5" style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-danger">Most Likely Root Cause</div>
            <p className="text-lg font-semibold leading-snug">{rejection.likelyRootCause}</p>
          </div>

          <div className="apple-card p-5">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2.5">Title Mismatch Assessment</div>
            <p className="text-sm leading-relaxed">{rejection.titleMismatch}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Patterns Found</div>
              {rejection.patterns?.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2.5 text-sm leading-relaxed">
                  <span className="font-semibold shrink-0 text-muted-foreground">{i + 1}.</span>{p}
                </div>
              ))}
            </div>
            <div className="rounded-xl p-5" style={{ background: "hsl(var(--warning-bg))", border: "1px solid hsl(var(--warning-border))" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-3 text-warning">Fix Immediately</div>
              {rejection.quickFixes?.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2.5 text-sm leading-relaxed" style={{ color: "hsl(25 50% 22%)" }}>
                  <span className="text-warning">→</span>{f}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-5" style={{ background: "hsl(var(--success-bg))", border: "1px solid hsl(var(--success-border))" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-success">Best Role to Target</div>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>{rejection.roleToTarget}</p>
            </div>
            <div className="apple-card p-5">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-3">Longer-Term Positioning</div>
              {rejection.deeperFixes?.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2.5 text-sm leading-relaxed">
                  <span className="shrink-0">📌</span>{f}
                </div>
              ))}
            </div>
          </div>

          <div className="apple-card p-4">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">Companies to Avoid</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{rejection.companiesToAvoid}</p>
          </div>
        </div>
      )}

      {rejection?.error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "hsl(var(--danger-bg))", border: "1px solid hsl(var(--danger-border))", color: "hsl(var(--danger))" }}>
          No rejection data found — track some applications first.
        </div>
      )}
    </div>
  );
};

export default RejectionAnalysis;
