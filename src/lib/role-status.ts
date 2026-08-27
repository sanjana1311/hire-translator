/**
 * A single, unambiguous status per imported role, derived from the record's
 * own data plus its application state. "Pending" is deliberately never used.
 */

export type RoleStatus =
  | "needs_review"
  | "confirmed"
  | "scored"
  | "tailored"
  | "applied"
  | "interviewing"
  | "rejected"
  | "archived";

export interface RoleStatusMeta {
  key: RoleStatus;
  label: string;
  /** Tailwind classes for the status pill */
  className: string;
  nextAction: string;
}

export const ROLE_STATUS_META: Record<RoleStatus, RoleStatusMeta> = {
  needs_review: { key: "needs_review", label: "Needs review", className: "bg-warning/10 text-warning border-warning/25", nextAction: "Review details" },
  confirmed:    { key: "confirmed",    label: "Confirmed",    className: "bg-secondary text-secondary-foreground border-transparent", nextAction: "Score role" },
  scored:       { key: "scored",       label: "Scored",       className: "bg-accent/10 text-accent border-accent/25", nextAction: "Tailor resume" },
  tailored:     { key: "tailored",     label: "Tailored",     className: "bg-accent/15 text-accent border-accent/30", nextAction: "Apply" },
  applied:      { key: "applied",      label: "Applied",      className: "bg-success/10 text-success border-success/25", nextAction: "View application" },
  interviewing: { key: "interviewing", label: "Interviewing", className: "bg-success/15 text-success border-success/30", nextAction: "Prepare" },
  rejected:     { key: "rejected",     label: "Rejected",     className: "bg-destructive/10 text-destructive border-destructive/25", nextAction: "Analyze rejection" },
  archived:     { key: "archived",     label: "Archived",     className: "bg-secondary text-muted-foreground border-transparent", nextAction: "Restore" },
};

/** Ordered progress timeline shown on the role detail page. */
export const ROLE_PROGRESS: RoleStatus[] = ["confirmed", "scored", "tailored", "applied"];

export interface RoleStatusInput {
  needsReview: boolean;
  hasScore: boolean;
  hasTailoredResume: boolean;
  /** Status of the linked application row, if any */
  applicationStatus?: string | null;
  archived?: boolean;
}

export function deriveRoleStatus(input: RoleStatusInput): RoleStatus {
  if (input.archived) return "archived";

  const app = (input.applicationStatus ?? "").toLowerCase();
  if (app === "rejected") return "rejected";
  if (app === "interview" || app === "interviewing" || app === "screening") return "interviewing";
  if (app) return "applied";

  if (input.needsReview) return "needs_review";
  if (input.hasTailoredResume) return "tailored";
  if (input.hasScore) return "scored";
  return "confirmed";
}

export function statusMeta(status: RoleStatus): RoleStatusMeta {
  return ROLE_STATUS_META[status];
}
