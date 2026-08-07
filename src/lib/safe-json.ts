/**
 * Helpers for turning possibly-messy LLM output into safe, typed JSON.
 * Never surface raw provider text to end users.
 */

/** Strip markdown fences and isolate the outermost JSON object. */
export function extractJsonText(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Remove ```json ... ``` / ``` ... ``` fences (including unterminated ones).
  s = s.replace(/```(?:json|JSON)?/g, "").trim();

  const start = s.indexOf("{");
  if (start === -1) return s;

  // Walk the string to find the matching closing brace (string-aware).
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  // Truncated response: close any open string/braces so JSON.parse can succeed.
  let repaired = s.slice(start);
  repaired = repaired.replace(/,\s*$/, "");
  if (inString) repaired += '"';
  // Drop a trailing incomplete key/value pair like `,"gaps":[` remnants.
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  while (depth-- > 0) repaired += "}";
  return repaired;
}

/** Parse LLM output into an object, or return null if it cannot be parsed. */
export function parseJsonLoose<T = unknown>(raw: string): T | null {
  const candidate = extractJsonText(raw);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Second attempt: remove trailing commas.
    try {
      return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1")) as T;
    } catch {
      return null;
    }
  }
}

export interface ScoreAnalysis {
  score: number;
  bucket: "must" | "tweak" | "low";
  matchSummary: string;
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  recommendation: string;
  error?: boolean;
}

const clampScore = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const toStringList = (v: unknown, max = 5): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : x == null ? "" : String(x)))
    .filter(Boolean)
    .slice(0, max);
};

const bucketFor = (score: number): ScoreAnalysis["bucket"] =>
  score >= 75 ? "must" : score >= 40 ? "tweak" : "low";

/** Coerce anything into a complete, render-safe analysis object. */
export function normalizeAnalysis(input: unknown): ScoreAnalysis {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const score = clampScore(o.score);
  const rawBucket = typeof o.bucket === "string" ? o.bucket.toLowerCase().trim() : "";
  const bucket = (["must", "tweak", "low"] as const).includes(rawBucket as ScoreAnalysis["bucket"])
    ? (rawBucket as ScoreAnalysis["bucket"])
    : bucketFor(score);

  return {
    score,
    bucket,
    matchSummary:
      typeof o.matchSummary === "string" && o.matchSummary.trim()
        ? o.matchSummary.trim()
        : "No summary available for this match.",
    strengths: toStringList(o.strengths, 3),
    gaps: toStringList(o.gaps, 3),
    missingKeywords: toStringList(o.missingKeywords, 5),
    recommendation:
      typeof o.recommendation === "string" && o.recommendation.trim()
        ? o.recommendation.trim()
        : bucket === "must"
          ? "Strong fit — apply with a lightly tailored resume."
          : bucket === "tweak"
            ? "Worth applying after tailoring your resume to the gaps above."
            : "Low fit — prioritise other roles unless you can close the gaps.",
  };
}

/** Fallback shown when scoring fails. Never contains provider output. */
export function failedAnalysis(): ScoreAnalysis {
  return {
    ...normalizeAnalysis({}),
    matchSummary: "Scoring temporarily failed. Please retry.",
    recommendation: "Retry scoring in a moment.",
    error: true,
  };
}
