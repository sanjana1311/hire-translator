/**
 * Freshness of an imported job alert.
 *
 * Job alerts go stale fast — a posting the user never acted on for 10+ days is
 * very likely closed or flooded with applicants. We surface that in the UI so
 * users know what to prioritise and what to let go.
 */

export type FreshnessLevel = "applied" | "fresh" | "aging" | "stale";

export interface Freshness {
  days: number;
  level: FreshnessLevel;
  label: string;
  /** Short helper copy shown on stale rows */
  hint?: string;
}

export const STALE_AFTER_DAYS = 10;
export const AGING_AFTER_DAYS = 5;

export function daysSince(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function getFreshness(
  importedAt: string | null | undefined,
  applied: boolean,
  now: number = Date.now()
): Freshness {
  const days = daysSince(importedAt, now);

  if (applied) {
    return { days, level: "applied", label: "Applied" };
  }
  if (days >= STALE_AFTER_DAYS) {
    return {
      days,
      level: "stale",
      label: `${days}d old · no action`,
      hint: "Posting is likely closed — apply today or clear it out",
    };
  }
  if (days >= AGING_AFTER_DAYS) {
    return {
      days,
      level: "aging",
      label: `${days}d old`,
      hint: `Apply within ${STALE_AFTER_DAYS - days}d to stay competitive`,
    };
  }
  return { days, level: "fresh", label: days <= 0 ? "New today" : `${days}d ago` };
}

export const FRESHNESS_STYLES: Record<FreshnessLevel, string> = {
  applied: "bg-success/10 text-success border-success/20",
  fresh: "bg-secondary text-muted-foreground border-transparent",
  aging: "bg-warning/10 text-warning border-warning/20",
  stale: "bg-destructive/10 text-destructive border-destructive/20",
};
