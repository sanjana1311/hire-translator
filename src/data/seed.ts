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

export const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  applied:   { label: "Applied",   dot: "hsl(30 5% 59%)",   bg: "hsl(33 12% 92%)",   border: "hsl(33 12% 85%)",   text: "hsl(30 5% 35%)" },
  screening: { label: "Screening", dot: "hsl(25 84% 31%)",  bg: "hsl(37 60% 97%)",   border: "hsl(37 40% 80%)",   text: "hsl(25 84% 31%)" },
  interview: { label: "Interview", dot: "hsl(226 71% 48%)", bg: "hsl(214 100% 97%)",  border: "hsl(213 93% 87%)",  text: "hsl(226 71% 48%)" },
  offer:     { label: "Offer 🎉",  dot: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)",   border: "hsl(152 34% 82%)",  text: "hsl(153 40% 30%)" },
  rejected:  { label: "Rejected",  dot: "hsl(348 46% 28%)", bg: "hsl(0 38% 97%)",     border: "hsl(348 28% 85%)",  text: "hsl(348 46% 28%)" },
};

export const BUCKET_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  must:  { label: "Must Apply",     dot: "hsl(153 40% 30%)", text: "hsl(153 40% 30%)", bg: "hsl(150 38% 96%)",  border: "hsl(152 34% 82%)" },
  tweak: { label: "Needs Tweaking", dot: "hsl(25 84% 31%)",  text: "hsl(25 84% 31%)",  bg: "hsl(37 60% 97%)",  border: "hsl(37 40% 80%)" },
  low:   { label: "Low Alignment",  dot: "hsl(348 46% 28%)", text: "hsl(348 46% 28%)", bg: "hsl(0 38% 97%)",   border: "hsl(348 28% 85%)" },
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
