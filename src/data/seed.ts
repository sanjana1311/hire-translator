// Utility functions and type definitions only — NO personal data

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  url: string;
  source: string;
  description: string;
}

export interface Application {
  jobId: number;
  title: string;
  company: string;
  appliedDate: string;
  status: string;
  lastEmail: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  nextAction: string | null;
  notes: string;
}

// Theme-aware tokens — these resolve differently in light and dark mode so
// badges stay legible in both themes.
export const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  applied:   { label: "Applied",   dot: "hsl(var(--muted-foreground))", bg: "hsl(var(--secondary))",   border: "hsl(var(--border))",        text: "hsl(var(--secondary-foreground))" },
  screening: { label: "Screening", dot: "hsl(var(--warning))",          bg: "hsl(var(--warning-bg))",  border: "hsl(var(--warning-border))", text: "hsl(var(--warning))" },
  interview: { label: "Interview", dot: "hsl(var(--info))",             bg: "hsl(var(--info-bg))",     border: "hsl(var(--info-border))",    text: "hsl(var(--info))" },
  offer:     { label: "Offer 🎉",  dot: "hsl(var(--success))",          bg: "hsl(var(--success-bg))",  border: "hsl(var(--success-border))", text: "hsl(var(--success))" },
  rejected:  { label: "Rejected",  dot: "hsl(var(--danger))",           bg: "hsl(var(--danger-bg))",   border: "hsl(var(--danger-border))",  text: "hsl(var(--danger))" },
};

export const BUCKET_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  must:  { label: "Must Apply",     dot: "hsl(var(--success))", text: "hsl(var(--success))", bg: "hsl(var(--success-bg))", border: "hsl(var(--success-border))" },
  tweak: { label: "Needs Tweaking", dot: "hsl(var(--warning))", text: "hsl(var(--warning))", bg: "hsl(var(--warning-bg))", border: "hsl(var(--warning-border))" },
  low:   { label: "Low Alignment",  dot: "hsl(var(--danger))",  text: "hsl(var(--danger))",  bg: "hsl(var(--danger-bg))",  border: "hsl(var(--danger-border))" },
};

export function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function scoreColor(score: number) {
  return score >= 75 ? "hsl(153 40% 30%)" : score >= 40 ? "hsl(25 84% 31%)" : "hsl(348 46% 28%)";
}

export function scoreBg(score: number) {
  return score >= 75 ? "hsl(150 38% 96%)" : score >= 40 ? "hsl(37 60% 97%)" : "hsl(0 38% 97%)";
}

export function scoreBorder(score: number) {
  return score >= 75 ? "hsl(152 34% 82%)" : score >= 40 ? "hsl(37 40% 80%)" : "hsl(348 28% 85%)";
}
