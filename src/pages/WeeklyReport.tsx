import { useState } from "react";
import { callAI } from "@/lib/ai";
import { INITIAL_APPLICATIONS, INITIAL_JOBS, fmtDate, daysSince } from "@/data/seed";

const Spinner = ({ size = 16 }: { size?: number }) => (
  <div className="border-2 border-border border-t-foreground rounded-full animate-spin" style={{ width: size, height: size }} />
);

interface Report {
  opening?: string;
  whatTheDataSays?: string;
  alertNoise?: string;
  titleProblem?: string;
  topStrategicInsight?: string;
  thisWeekActions?: string[];
  roleToDoubleDown?: string;
  encouragement?: string;
  error?: boolean;
  message?: string;
}

const WeeklyReport = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const apps = INITIAL_APPLICATIONS;
      const appSummary = apps.map(a => `- ${a.company} (${a.title}): ${a.status}. Applied ${fmtDate(a.appliedDate)}, ${daysSince(a.appliedDate)} days ago. Last email: ${a.lastEmail ? fmtDate(a.lastEmail) : "none"}. Notes: ${a.notes || "none"}`).join("\n");
      const rejections = apps.filter(a => a.status === "rejected");
      const pending = apps.filter(a => a.status === "applied" && !a.lastEmail);
      const jobScores = INITIAL_JOBS.map(j => `${j.company} — ${j.title}: not yet scored`).join("\n");

      const raw = await callAI(`You are a senior career mentor — direct, warm, strategic. NOT a dashboard generator. Write like you are sitting with Sanjana over coffee. Use "you" not "the candidate". Be honest, specific, encouraging. Return ONLY valid JSON.

WHO SHE IS: Sanjana Ravikumar — PM at Tesla, building GenAI communication systems. PMP certified. 4+ years. Strong AI/ML background. 18K LinkedIn followers. Targeting senior PM or TPM roles at top-tier tech.

TODAY'S DATE: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

REAL APPLICATION DATA:
${appSummary}

REJECTION COUNT: ${rejections.length} rejections (${rejections.map(r => r.company).join(", ")})
PENDING WITH NO REPLY: ${pending.length} (${pending.map(p => p.company).join(", ")})
TOTAL APPLICATIONS: ${apps.length}
ZERO interview invites so far.

TODAY'S ROLE SCORES:
${jobScores}

Return: {
  "opening": "2-3 sentences talking directly to her like a mentor",
  "whatTheDataSays": "2-3 sentences synthesizing the honest pattern",
  "alertNoise": "1-2 sentences about inbox noise and what to clean up",
  "titleProblem": "honest 2-sentence take on Program Manager vs Product Manager title friction",
  "topStrategicInsight": "the single most important thing she needs to hear this week",
  "thisWeekActions": ["5 concrete actions referencing actual companies"],
  "roleToDoubleDown": "which role to focus on and why",
  "encouragement": "1 genuine non-generic sentence"
}`, 2000);
      setReport(JSON.parse(raw));
    } catch (e: any) {
      console.error("Report error:", e);
      setReport({ error: true, message: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-[760px] mx-auto p-7 pt-9">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-serif text-[26px] font-normal mb-1">Weekly Mentor Session</h1>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Pulled from your real inbox</p>
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="bg-foreground text-background rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 shrink-0"
        >
          {loading ? "Reading your inbox…" : report ? "Refresh" : "Get My Briefing"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-5">Reads your applications, rejections, and email patterns — then talks to you like a mentor, not a dashboard</p>

      {loading && (
        <div className="text-center py-16 bg-card border border-border rounded-[11px]">
          <Spinner size={20} />
          <p className="animate-pulse-dot text-xs text-muted-foreground mt-3.5">Reading your inbox and thinking through your search…</p>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-card border border-border rounded-[11px] p-12 text-center">
          <div className="font-serif text-xl italic text-muted-foreground mb-2.5">What would your career mentor say right now?</div>
          <p className="text-xs text-muted-foreground leading-relaxed">This reads your actual inbox — applications sent, rejections received, alert patterns — and gives you a real mentor conversation, not generic advice.</p>
        </div>
      )}

      {report && !report.error && (
        <div className="animate-fade-up flex flex-col gap-3.5">
          {/* Opening */}
          <div className="bg-card border border-border rounded-[11px] p-6">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-3">From your mentor</div>
            <p className="font-serif text-[17px] leading-relaxed mb-2.5">{report.opening}</p>
            <p className="text-xs text-secondary-foreground leading-relaxed border-t border-border pt-3">{report.whatTheDataSays}</p>
          </div>
          {/* Title problem */}
          <div className="rounded-[11px] p-5" style={{ background: "hsl(37 60% 97%)", border: "1px solid hsl(37 40% 80%)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(25 84% 31%)" }}>The title question you need to address</div>
            <p className="text-xs leading-relaxed" style={{ color: "hsl(25 50% 22%)" }}>{report.titleProblem}</p>
          </div>
          {/* Alert noise */}
          <div className="bg-card border border-border rounded-[9px] p-4 flex gap-2.5 items-start">
            <span className="text-sm shrink-0">📬</span>
            <div>
              <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-1">Clean up your alerts</div>
              <p className="text-xs leading-relaxed">{report.alertNoise}</p>
            </div>
          </div>
          {/* Top strategic insight */}
          <div className="bg-foreground rounded-[11px] p-5">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-2.5">The thing your mentor really wants to say</div>
            <p className="font-serif text-[17px] leading-relaxed text-background italic">{report.topStrategicInsight}</p>
          </div>
          {/* This week actions */}
          <div className="bg-card border border-border rounded-[11px] p-5">
            <div className="text-[10px] text-secondary-foreground font-bold uppercase tracking-wide mb-3.5">Your 5 moves this week — in order</div>
            {report.thisWeekActions?.map((a, i) => (
              <div key={i} className="flex gap-3 items-start mb-3 pb-3" style={{ borderBottom: i < (report.thisWeekActions!.length - 1) ? "1px solid hsl(var(--border))" : "none" }}>
                <div className="w-6 h-6 bg-foreground rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-background text-[10px] font-bold">{i + 1}</span>
                </div>
                <span className="text-xs leading-relaxed pt-1">{a}</span>
              </div>
            ))}
          </div>
          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[11px] p-4" style={{ background: "hsl(214 100% 97%)", border: "1px solid hsl(213 93% 87%)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(226 71% 48%)" }}>Put your energy here</div>
              <p className="text-xs leading-relaxed" style={{ color: "hsl(226 50% 25%)" }}>{report.roleToDoubleDown}</p>
            </div>
            <div className="rounded-[11px] p-4 flex flex-col justify-center" style={{ background: "hsl(150 38% 96%)", border: "1px solid hsl(152 34% 82%)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "hsl(153 40% 30%)" }}>Remember</div>
              <p className="font-serif text-sm italic leading-relaxed" style={{ color: "hsl(153 30% 25%)" }}>{report.encouragement}</p>
            </div>
          </div>
        </div>
      )}

      {report?.error && (
        <div className="rounded-[9px] p-4 text-xs" style={{ background: "hsl(0 38% 97%)", border: "1px solid hsl(348 28% 85%)", color: "hsl(348 46% 28%)" }}>
          <strong>Could not generate report</strong> — {report.message || "please retry."}
        </div>
      )}
    </div>
  );
};

export default WeeklyReport;
