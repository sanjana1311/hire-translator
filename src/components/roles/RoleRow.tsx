import { AlertTriangle } from "lucide-react";
import { initials } from "@/data/seed";
import { cleanText } from "@/lib/clean-text";
import { displayTitle, displayCompany, displayLocation, type ReviewAssessment } from "@/lib/job-review";
import { statusMeta, type RoleStatus } from "@/lib/role-status";
import { scoreColor } from "@/data/seed";

export interface RoleRowJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string | null;
  imported_at: string;
  confirmed_at?: string | null;
}

export const importedAtLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Import date unknown";
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? `Today ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

interface RoleRowProps {
  job: RoleRowJob;
  assessment: ReviewAssessment;
  status: RoleStatus;
  score?: number | null;
  busy?: boolean;
  onOpen: () => void;
  onAction: () => void;
}

export default function RoleRow({ job, assessment, status, score, busy, onOpen, onAction }: RoleRowProps) {
  const meta = statusMeta(status);
  const needsReview = status === "needs_review";
  const title = needsReview ? displayTitle(job, assessment) : cleanText(job.title);

  return (
    <div
      onClick={onOpen}
      className={`apple-card apple-card-interactive p-4 flex items-center gap-3 ${needsReview ? "border-warning/30" : ""}`}
    >
      <div className="w-[38px] h-[38px] bg-secondary rounded-lg flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-secondary-foreground">
          {assessment.companyConfident || job.confirmed_at ? initials(job.company || "?") : "?"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
          <span className={`text-sm font-semibold ${needsReview ? "text-muted-foreground italic" : ""}`}>{title}</span>
          <span className={`text-[10px] font-medium rounded-md border px-1.5 py-0.5 ${meta.className}`}>
            {meta.label}
          </span>
          {typeof score === "number" && (
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{score}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {displayCompany(job, assessment)} · {displayLocation(job, assessment)}
        </div>
        <div className="text-[10.5px] text-muted-foreground/70 mt-0.5">
          Imported {importedAtLabel(job.imported_at)}{job.source ? ` · ${job.source}` : ""}
        </div>
        {needsReview && (
          <div className="text-[10.5px] text-warning mt-1 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            Needs review — job details could not be confirmed.
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onAction(); }}
        disabled={busy}
        className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {busy ? "Working…" : meta.nextAction}
      </button>
    </div>
  );
}
