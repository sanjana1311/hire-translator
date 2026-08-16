import { supabase } from "@/integrations/supabase/client";
import { normalizeAnalysis, type ScoreAnalysis } from "@/lib/safe-json";

export type ScoreMap = Record<string, ScoreAnalysis>;

/** Stable key for a persisted score: user (profile) + job + resume version. */
export function scoreKey(profileId: string, jobId: string, resumeId?: string | null): string {
  return `${profileId}::${jobId}::${resumeId ?? "no-resume"}`;
}

/**
 * Merge freshly loaded/produced scores into the existing map.
 * Existing entries for OTHER jobs are always preserved — a new score can only
 * ever replace the entry for its own job id.
 */
export function mergeScores(prev: ScoreMap, incoming: ScoreMap): ScoreMap {
  return { ...prev, ...incoming };
}

/** Remove a single job's score without touching any other job. */
export function removeScore(prev: ScoreMap, jobId: string): ScoreMap {
  const next = { ...prev };
  delete next[jobId];
  return next;
}

export interface JobScoreRow {
  imported_job_id: string;
  resume_id: string | null;
  analysis: unknown;
  score: number | null;
  bucket: string | null;
  match_summary: string | null;
  strengths: unknown;
  gaps: unknown;
  missing_keywords: unknown;
  recommendation: string | null;
}

/** Convert persisted rows into a job-id keyed score map. */
export function rowsToScoreMap(rows: JobScoreRow[]): ScoreMap {
  const map: ScoreMap = {};
  for (const row of rows) {
    const source =
      row.analysis && typeof row.analysis === "object"
        ? row.analysis
        : {
            score: row.score,
            bucket: row.bucket,
            matchSummary: row.match_summary,
            strengths: row.strengths,
            gaps: row.gaps,
            missingKeywords: row.missing_keywords,
            recommendation: row.recommendation,
          };
    const normalized = normalizeAnalysis(source);
    if (normalized.error) continue;
    map[row.imported_job_id] = normalized;
  }
  return map;
}

/** Load every saved score for a user (all jobs, all resume versions). */
export async function loadJobScores(profileId: string): Promise<ScoreMap> {
  const { data, error } = await supabase
    .from("job_scores" as any)
    .select("imported_job_id,resume_id,analysis,score,bucket,match_summary,strengths,gaps,missing_keywords,recommendation,updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: true });
  if (error) {
    console.error("[job-scores] load failed:", error.message);
    return {};
  }
  return rowsToScoreMap((data ?? []) as unknown as JobScoreRow[]);
}

/** Upsert one score. Only the row for this user+job+resume is written. */
export async function saveJobScore(params: {
  profileId: string;
  jobId: string;
  resumeId?: string | null;
  analysis: ScoreAnalysis;
}): Promise<void> {
  const { profileId, jobId, resumeId, analysis } = params;
  const payload = {
    profile_id: profileId,
    imported_job_id: jobId,
    resume_id: resumeId ?? null,
    score: analysis.score,
    bucket: analysis.bucket,
    match_summary: analysis.matchSummary,
    strengths: analysis.strengths,
    gaps: analysis.gaps,
    missing_keywords: analysis.missingKeywords,
    recommendation: (analysis as any).recommendation ?? null,
    analysis: analysis as any,
  };

  const { data: existing } = await supabase
    .from("job_scores" as any)
    .select("id")
    .eq("profile_id", profileId)
    .eq("imported_job_id", jobId)
    .is("resume_id", resumeId ? (undefined as any) : null)
    .maybeSingle();

  if (resumeId) {
    const { data: row } = await supabase
      .from("job_scores" as any)
      .select("id")
      .eq("profile_id", profileId)
      .eq("imported_job_id", jobId)
      .eq("resume_id", resumeId)
      .maybeSingle();
    if (row) {
      await supabase.from("job_scores" as any).update(payload).eq("id", (row as any).id);
      return;
    }
  } else if (existing) {
    await supabase.from("job_scores" as any).update(payload).eq("id", (existing as any).id);
    return;
  }

  const { error } = await supabase.from("job_scores" as any).insert(payload);
  if (error) console.error("[job-scores] save failed:", error.message);
}

/** Delete a saved score for one job (all resume versions). */
export async function deleteJobScore(profileId: string, jobId: string): Promise<void> {
  await supabase
    .from("job_scores" as any)
    .delete()
    .eq("profile_id", profileId)
    .eq("imported_job_id", jobId);
}
