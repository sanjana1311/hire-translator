/**
 * Quality assessment for imported job rows.
 *
 * Gmail job-alert parsing is best effort: some emails yield a clean
 * title/company/location, others leave behind a fragment of the email subject
 * ("Billion in IPO", "Application Update", "Thank you for applying…").
 * Those records must never be shown as if they were real roles — they go into
 * "Needs your review" instead.
 */

export type ReviewSeverity = "high" | "low";

export interface ReviewReason {
  field: "title" | "company" | "location" | "description";
  severity: ReviewSeverity;
  message: string;
}

export interface ReviewAssessment {
  needsReview: boolean;
  reasons: ReviewReason[];
  titleConfident: boolean;
  companyConfident: boolean;
  locationConfident: boolean;
  descriptionComplete: boolean;
}

export interface ReviewableJob {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  snippet?: string | null;
  confirmed_at?: string | null;
  /** Server-side import validation label set during Gmail sync. */
  import_quality?: "valid" | "needs_review" | "invalid_import" | null;
  import_issues?: string[] | null;
}

const ROLE_TOKENS = [
  "manager", "engineer", "developer", "analyst", "designer", "scientist",
  "architect", "consultant", "coordinator", "specialist", "director",
  "intern", "internship", "lead", "head of", "associate", "strategist",
  "strategy", "operations", "product", "program", "project", "researcher",
  "recruiter", "administrator", "technician", "president", "officer",
];

const PLACEHOLDERS = ["", "unknown", "n/a", "na", "none", "role not specified", "not specified", "-"];

/** Email-subject fragments that are never real job titles. */
const JUNK_TITLE_PATTERNS: RegExp[] = [
  /thank you for/i,
  /thanks for applying/i,
  /your application/i,
  /application update/i,
  /apply to\b/i,
  /\b(hi|hello|dear)\s+[A-Z]/,
  /\bjobs?\s+in\b/i,
  /new job opportunit/i,
  /explore new job/i,
  /recommendations based on/i,
  /job alert/i,
  /recruitment team/i,
  /role spotlight/i,
  /learn more about/i,
  /newsletter/i,
  /unsubscribe/i,
  /\bipo\b/i,
  /we (regret|have decided)/i,
  /moving forward with other candidates/i,
];

const clean = (v?: string | null) => (v ?? "").replace(/\s+/g, " ").trim();
const isPlaceholder = (v: string) => PLACEHOLDERS.includes(v.toLowerCase());
const hasRoleToken = (v: string) => {
  const lower = v.toLowerCase();
  return ROLE_TOKENS.some((t) => lower.includes(t));
};

export function assessJob(job: ReviewableJob): ReviewAssessment {
  const title = clean(job.title);
  const company = clean(job.company);
  const location = clean(job.location);
  const description = clean(job.description) || clean(job.snippet);

  const reasons: ReviewReason[] = [];

  // ── Title ──
  let titleConfident = true;
  if (isPlaceholder(title)) {
    titleConfident = false;
    reasons.push({ field: "title", severity: "high", message: "Job title is missing" });
  } else if (JUNK_TITLE_PATTERNS.some((re) => re.test(title))) {
    titleConfident = false;
    reasons.push({ field: "title", severity: "high", message: "Title looks like email text, not a role" });
  } else if (/^[a-z]/.test(title)) {
    titleConfident = false;
    reasons.push({ field: "title", severity: "high", message: "Title starts mid-sentence — likely a subject fragment" });
  } else if (title.split(" ").length > 14) {
    titleConfident = false;
    reasons.push({ field: "title", severity: "high", message: "Title is too long to be a real role" });
  } else if (!hasRoleToken(title)) {
    titleConfident = false;
    reasons.push({ field: "title", severity: "high", message: "Title could not be confirmed as a job role" });
  }

  // ── Company ──
  let companyConfident = true;
  if (isPlaceholder(company)) {
    companyConfident = false;
    reasons.push({ field: "company", severity: "high", message: "Company is missing" });
  } else if (hasRoleToken(company)) {
    companyConfident = false;
    reasons.push({ field: "company", severity: "high", message: "Company field contains a job title" });
  } else if (/,\s*[A-Z]{2}\b/.test(company) || /united states|remote/i.test(company)) {
    companyConfident = false;
    reasons.push({ field: "company", severity: "high", message: "Company field contains a location" });
  } else if (/^[a-z]/.test(company) || company.split(" ").length > 6) {
    companyConfident = false;
    reasons.push({ field: "company", severity: "high", message: "Company could not be confirmed" });
  }

  // ── Location (low confidence only — never blocks on its own) ──
  let locationConfident = true;
  if (isPlaceholder(location)) {
    locationConfident = false;
    reasons.push({ field: "location", severity: "low", message: "Location is missing" });
  } else if (location.includes("·") || hasRoleToken(location)) {
    locationConfident = false;
    reasons.push({ field: "location", severity: "low", message: "Location looks unreliable" });
  }

  // ── Description ──
  const descriptionComplete = description.length >= 200;
  if (!descriptionComplete) {
    reasons.push({ field: "description", severity: "low", message: "Job description is incomplete" });
  }

  // ── Server-side import validation (authoritative) ──
  const quality = job.import_quality ?? null;
  if (quality === "invalid_import" || quality === "needs_review") {
    for (const issue of job.import_issues ?? []) {
      reasons.push({ field: "title", severity: "high", message: issue });
    }
    if ((job.import_issues ?? []).length === 0) {
      reasons.push({
        field: "title",
        severity: "high",
        message:
          quality === "invalid_import"
            ? "Import failed validation — fields may be mixed between listings"
            : "Import needs review",
      });
    }
  }

  const confirmed = !!job.confirmed_at;
  const needsReview = !confirmed && reasons.some((r) => r.severity === "high");

  return { needsReview, reasons, titleConfident, companyConfident, locationConfident, descriptionComplete };
}

/**
 * A role may only be confirmed once its structural fields are trustworthy.
 * Confirming hides a role from "Needs your review" forever, so a record with a
 * junk title or a company that is really a location must be fixed first.
 */
export function confirmationBlockers(job: ReviewableJob): string[] {
  const a = assessJob({ ...job, confirmed_at: null });
  return a.reasons
    .filter((r) => r.severity === "high" && (r.field === "title" || r.field === "company"))
    .map((r) => r.message);
}

export function canConfirmJob(job: ReviewableJob): boolean {
  return confirmationBlockers(job).length === 0;
}

/** Title safe to render in a list — never leaks malformed email text. */
export function displayTitle(job: ReviewableJob, assessment?: ReviewAssessment): string {
  const a = assessment ?? assessJob(job);
  if (a.titleConfident || job.confirmed_at) return clean(job.title) || "Title needs review";
  return "Title needs review";
}

export function displayCompany(job: ReviewableJob, assessment?: ReviewAssessment): string {
  const a = assessment ?? assessJob(job);
  if (a.companyConfident || job.confirmed_at) return clean(job.company) || "Company unknown";
  return "Company needs review";
}

export function displayLocation(job: ReviewableJob, assessment?: ReviewAssessment): string {
  const a = assessment ?? assessJob(job);
  if (a.locationConfident) return clean(job.location) || "Remote";
  return clean(job.location) ? `${clean(job.location)} (unconfirmed)` : "Location unknown";
}
