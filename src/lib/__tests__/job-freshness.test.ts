import { describe, it, expect } from "vitest";
import { getFreshness, STALE_AFTER_DAYS } from "@/lib/job-freshness";

const now = new Date("2026-08-22T00:00:00Z").getTime();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("getFreshness", () => {
  it("marks brand new alerts as fresh", () => {
    expect(getFreshness(daysAgo(0), false, now).level).toBe("fresh");
    expect(getFreshness(daysAgo(4), false, now).level).toBe("fresh");
  });

  it("marks mid-life alerts as aging", () => {
    expect(getFreshness(daysAgo(6), false, now).level).toBe("aging");
  });

  it("marks unapplied alerts older than the threshold as stale", () => {
    const f = getFreshness(daysAgo(STALE_AFTER_DAYS + 2), false, now);
    expect(f.level).toBe("stale");
    expect(f.days).toBe(STALE_AFTER_DAYS + 2);
    expect(f.hint).toMatch(/likely closed/i);
  });

  it("never marks an applied job as stale", () => {
    expect(getFreshness(daysAgo(40), true, now).level).toBe("applied");
  });
});
