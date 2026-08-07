// Anti-hallucination guardrails for AI-tailored resumes.
// Every generated claim is validated against the uploaded (source) resume.

export interface TailoredBullet {
  text: string;
  original?: string;
  confidence: "high" | "medium" | "low";
  note?: string;
  rejected?: boolean;
  reason?: string;
}

export interface TailoredExperience {
  title: string;
  company: string;
  dates: string;
  bullets: TailoredBullet[];
}

export interface TailoredResume {
  summary: string;
  experience: TailoredExperience[];
  verified_skills: string[];
  transferable_skills: string[];
  missing_requirements: string[];
  changes_made: string[];
  warnings: string[];
}

const STOPWORDS = new Set(
  `a an and the of for to in on with by at from as is are was were be been being that this these those it its their our your his her they we you i
  led lead leading built build building drove drive driving own owned owning ran run running made make making used use using create created creating
  improve improved improving deliver delivered delivering support supported supporting manage managed managing work worked working help helped
  across into over under between within through while about more most less least new also than then when where which who whom what how why
  team teams project projects product products process processes result results impact business customer customers user users data
  increase increased decrease decreased reduce reduced growth per via each all any other same both such not no yes`
    .split(/\s+/)
    .filter(Boolean)
);

const CERT_PATTERNS = [
  /\bcertified\b/i,
  /\bcertification[s]?\b/i,
  /\bcredential[s]?\b/i,
  /\blicensed\b/i,
  /\b(pmp|csm|cfa|cpa|aws certified|azure certified|scrum master)\b/i,
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9%.$+#/\s-]/g, " ");

const tokenize = (s: string) =>
  normalize(s)
    .split(/[\s/,-]+/)
    .map((t) => t.replace(/^[.$#+]+|[.$#+]+$/g, ""))
    .filter((t) => t.length >= 3);

function buildSourceIndex(sourceResume: string) {
  const text = normalize(sourceResume);
  const tokens = new Set(tokenize(sourceResume));
  const numbers = new Set((sourceResume.match(/\d[\d,.]*%?/g) || []).map((n) => n.replace(/[,]/g, "")));
  return { text, tokens, numbers };
}

export type SourceIndex = ReturnType<typeof buildSourceIndex>;

/** Returns the terms in `claim` that have no evidence in the source resume. */
export function unsupportedTerms(claim: string, idx: SourceIndex): string[] {
  return Array.from(
    new Set(
      tokenize(claim).filter(
        (t) => !STOPWORDS.has(t) && !idx.tokens.has(t) && !idx.text.includes(t) && /[a-z]/.test(t)
      )
    )
  );
}

/** Numbers/metrics that appear in the claim but not in the source resume. */
export function unsupportedNumbers(claim: string, idx: SourceIndex): string[] {
  return Array.from(
    new Set(
      (claim.match(/\d[\d,.]*%?/g) || [])
        .map((n) => n.replace(/[,]/g, ""))
        .filter((n) => !idx.numbers.has(n))
    )
  );
}

function claimsCertification(claim: string, idx: SourceIndex): boolean {
  return CERT_PATTERNS.some((re) => re.test(claim) && !re.test(idx.text));
}

/**
 * Validates a generated resume against the source resume.
 * Bullets with fabricated metrics or certifications are rejected outright;
 * bullets with unverifiable terminology are downgraded to low confidence.
 */
export function validateTailoredResume(
  generated: TailoredResume,
  sourceResume: string
): { resume: TailoredResume; rejectedCount: number; flaggedCount: number } {
  const idx = buildSourceIndex(sourceResume);
  let rejectedCount = 0;
  let flaggedCount = 0;

  const experience = (generated.experience || []).map((exp) => {
    const bullets = (exp.bullets || []).map((b) => {
      const text = typeof b === "string" ? (b as unknown as string) : b.text || "";
      const bullet: TailoredBullet = typeof b === "string" ? { text, confidence: "medium" } : { ...b, text };

      const badNumbers = unsupportedNumbers(text, idx);
      if (badNumbers.length) {
        rejectedCount++;
        return { ...bullet, rejected: true, confidence: "low" as const, reason: `Unsupported metric: ${badNumbers.join(", ")}` };
      }
      if (claimsCertification(text, idx)) {
        rejectedCount++;
        return { ...bullet, rejected: true, confidence: "low" as const, reason: "Certification not present in your resume" };
      }
      const unknown = unsupportedTerms(text, idx);
      if (unknown.length > 2) {
        flaggedCount++;
        return {
          ...bullet,
          confidence: "low" as const,
          note: `Wording changed substantially — verify: ${unknown.slice(0, 5).join(", ")}`,
        };
      }
      if (bullet.original && bullet.original.trim() !== text.trim()) {
        flaggedCount++;
        return { ...bullet, confidence: bullet.confidence === "high" ? "medium" : bullet.confidence, note: bullet.note || "Rewritten — confirm accuracy" };
      }
      return bullet;
    });
    return { ...exp, bullets };
  });

  // Only keep skills that literally exist in the source resume.
  const verified = (generated.verified_skills || []).filter((s) => idx.text.includes(normalize(s).trim()));
  const rejectedSkills = (generated.verified_skills || []).filter((s) => !idx.text.includes(normalize(s).trim()));

  const summaryBadNumbers = unsupportedNumbers(generated.summary || "", idx);
  const warnings = [...(generated.warnings || [])];
  if (summaryBadNumbers.length) warnings.push(`Summary metrics removed (not in source resume): ${summaryBadNumbers.join(", ")}`);
  if (rejectedSkills.length) warnings.push(`Skills moved to gaps (no evidence in your resume): ${rejectedSkills.join(", ")}`);

  let summary = generated.summary || "";
  if (summaryBadNumbers.length) {
    rejectedCount++;
    summaryBadNumbers.forEach((n) => {
      summary = summary.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
    });
    summary = summary.replace(/\s{2,}/g, " ").trim();
  }

  return {
    resume: {
      summary,
      experience,
      verified_skills: verified,
      transferable_skills: generated.transferable_skills || [],
      missing_requirements: Array.from(new Set([...(generated.missing_requirements || []), ...rejectedSkills])),
      changes_made: generated.changes_made || [],
      warnings,
    },
    rejectedCount,
    flaggedCount,
  };
}

export const TAILOR_SYSTEM_RULES = `You are a precision resume tailoring engine operating under STRICT truth boundaries.

HARD RULES:
- Use ONLY facts, roles, dates, employers, skills, tools, and metrics that appear in the SOURCE RESUME.
- NEVER invent certifications, employers, projects, responsibilities, degrees, or achievements.
- A skill appearing in the job description does NOT mean the candidate has it.
- Preserve original job titles, company names, and employment dates EXACTLY.
- Rewrite a bullet only when the underlying evidence already exists in the source resume.
- Keep every number/metric identical to the source. Never add a number that is not in the source.
- If a job requirement is not evidenced in the resume, put it in missing_requirements (a "Gap"), never in the resume body.
- verified_skills = skills literally present in the source resume.
  transferable_skills = adjacent skills the evidence supports indirectly (label only, do not assert mastery).
  missing_requirements = JD requirements with no evidence.
- For every bullet you rewrite, set confidence ("high" = near-verbatim, "medium" = reframed, "low" = heavily reworded) and set "original" to the source bullet it came from.

Return ONLY valid JSON.`;

export function buildTailorPrompt(opts: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  missingKeywords?: string[];
}) {
  return `${TAILOR_SYSTEM_RULES}

SOURCE RESUME (the only allowed source of truth):
${opts.resumeText}

TARGET ROLE: ${opts.jobTitle} at ${opts.company}

JOB DESCRIPTION:
${opts.jobDescription}

JD keywords to use ONLY if evidence exists (otherwise list as gaps): ${(opts.missingKeywords || []).join(", ") || "none"}

Return JSON exactly in this shape:
{
  "summary": "3-4 sentences, no invented facts, no new numbers",
  "experience": [{"title":"","company":"","dates":"","bullets":[{"text":"","original":"source bullet","confidence":"high|medium|low"}]}],
  "verified_skills": [],
  "transferable_skills": [],
  "missing_requirements": [],
  "changes_made": [],
  "warnings": []
}`;
}

/** Renders a validated resume to plain text for copy/export. */
export function tailoredResumeToText(r: TailoredResume): string {
  const lines: string[] = [];
  if (r.summary) lines.push("SUMMARY", r.summary, "");
  if (r.experience?.length) {
    lines.push("EXPERIENCE");
    r.experience.forEach((e) => {
      lines.push(`${e.title} — ${e.company} (${e.dates})`);
      e.bullets.filter((b) => !b.rejected).forEach((b) => lines.push(`• ${b.text}`));
      lines.push("");
    });
  }
  if (r.verified_skills?.length) lines.push("VERIFIED SKILLS", r.verified_skills.join(", "), "");
  if (r.transferable_skills?.length) lines.push("TRANSFERABLE SKILLS", r.transferable_skills.join(", "), "");
  if (r.missing_requirements?.length) lines.push("GAPS (not claimed on resume)", r.missing_requirements.map((m) => `- ${m}`).join("\n"), "");
  return lines.join("\n").trim();
}
