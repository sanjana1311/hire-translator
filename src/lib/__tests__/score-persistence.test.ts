import { describe, it, expect, beforeEach } from "vitest";
import { scoreKey, mergeScores, removeScore, rowsToScoreMap, type JobScoreRow } from "@/lib/job-scores";
import { normalizeAnalysis } from "@/lib/safe-json";

// A tiny in-memory stand-in for the job_scores table, keyed exactly like the
// real unique index: profile_id + imported_job_id + resume_id.
class FakeScoreStore {
  rows = new Map<string, JobScoreRow & { profile_id: string }>();

  save(profileId: string, jobId: string, resumeId: string | null, analysis: ReturnType<typeof normalizeAnalysis>) {
    this.rows.set(scoreKey(profileId, jobId, resumeId), {
      profile_id: profileId,
      imported_job_id: jobId,
      resume_id: resumeId,
      analysis,
      score: analysis.score,
      bucket: analysis.bucket,
      match_summary: analysis.matchSummary,
      strengths: analysis.strengths,
      gaps: analysis.gaps,
      missing_keywords: analysis.missingKeywords,
      recommendation: analysis.recommendation,
    });
  }

  load(profileId: string) {
    return rowsToScoreMap([...this.rows.values()].filter((r) => r.profile_id === profileId));
  }
}

const USER = "user-1";
const RESUME = "resume-1";

const makeScore = (score: number, label: string) =>
  normalizeAnalysis({
    score,
    matchSummary: `${label} summary`,
    strengths: [`${label} strength`],
    gaps: [`${label} gap`],
    missingKeywords: [`${label}-kw`],
    recommendation: `${label} recommendation`,
  });

describe("score persistence + tailoring isolation", () => {
  let store: FakeScoreStore;

  beforeEach(() => {
    store = new FakeScoreStore();
  });

  it("keeps every job's score independent across three jobs, a failed tailor, and a refresh", async () => {
    // --- Session state (what the page renders from) ---
    let results = store.load(USER);
    let tailorErrors: Record<string, string> = {};
    let tailorLoading = new Set<string>();

    // 1. Score job A
    const a = makeScore(82, "alpha");
    store.save(USER, "job-a", RESUME, a);
    results = mergeScores(results, { "job-a": a });

    // 2. Score job B — job A must survive
    const b = makeScore(61, "beta");
    store.save(USER, "job-b", RESUME, b);
    results = mergeScores(results, { "job-b": b });

    expect(Object.keys(results).sort()).toEqual(["job-a", "job-b"]);
    expect(results["job-a"].score).toBe(82);
    expect(results["job-b"].score).toBe(61);

    // 3. Tailor job C with a forced failure. Tailoring uses its own state.
    tailorLoading = new Set(["job-c"]);
    try {
      await Promise.reject(new Error("Tailoring temporarily failed — please retry"));
    } catch (e: any) {
      tailorErrors = { ...tailorErrors, "job-c": e.message };
    }
    tailorLoading = new Set([...tailorLoading].filter((id) => id !== "job-c"));

    expect(tailorErrors["job-c"]).toMatch(/temporarily failed/i);
    expect(tailorLoading.size).toBe(0);
    // Scoring state untouched by the tailoring failure.
    expect(Object.keys(results).sort()).toEqual(["job-a", "job-b"]);

    // 4. Refresh the page — reload everything from persistence.
    results = store.load(USER);
    tailorErrors = {};

    expect(Object.keys(results).sort()).toEqual(["job-a", "job-b"]);
    expect(results["job-a"]).toMatchObject({
      score: 82,
      matchSummary: "alpha summary",
      strengths: ["alpha strength"],
      gaps: ["alpha gap"],
      recommendation: "alpha recommendation",
    });
    expect(results["job-b"]).toMatchObject({ score: 61, matchSummary: "beta summary" });
  });

  it("scoring a new job never overwrites previously saved scores", () => {
    const first = { "job-a": makeScore(70, "a"), "job-b": makeScore(40, "b") };
    const merged = mergeScores(first, { "job-c": makeScore(90, "c") });
    expect(merged["job-a"].score).toBe(70);
    expect(merged["job-b"].score).toBe(40);
    expect(merged["job-c"].score).toBe(90);
  });

  it("re-scoring replaces only that job's entry", () => {
    let results = { "job-a": makeScore(70, "a"), "job-b": makeScore(40, "b") };
    results = mergeScores(removeScore(results, "job-a"), { "job-a": makeScore(88, "a2") });
    expect(results["job-a"].score).toBe(88);
    expect(results["job-b"].score).toBe(40);
  });

  it("keys scores by user + job + resume version", () => {
    store.save(USER, "job-a", "resume-1", makeScore(50, "old"));
    store.save(USER, "job-a", "resume-2", makeScore(77, "new"));
    store.save("user-2", "job-a", "resume-1", makeScore(10, "other"));

    expect(store.rows.size).toBe(3);
    // Latest resume version wins for display, other users are isolated.
    expect(store.load(USER)["job-a"].score).toBe(77);
    expect(store.load("user-2")["job-a"].score).toBe(10);
  });
});
