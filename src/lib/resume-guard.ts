// Evidence-first guardrails for AI-tailored resumes.
// Every generated claim must be linked to evidence in the uploaded (source) resume.

export interface TailoredBullet {
  text: string;
  original?: string;
  /** Verbatim (or near-verbatim) snippet from the source resume backing this bullet. */
  evidence?: string;
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

export type RequirementStatus = "verified" | "transferable" | "missing";

export interface ClassifiedRequirement {
  requirement: string;
  status: RequirementStatus;
  evidence?: string;
}

/** Structured parse of the source resume. */
export interface ParsedResume {
  contact?: { name?: string; email?: string; phone?: string; location?: string; links?: string[] };
  experience: { title: string; employer: string; dates: string; responsibilities: string[]; achievements: string[] }[];
  skills: string[];
  tools: string[];
  certifications: string[];
  education: { degree: string; institution: string; dates?: string }[];
  metrics: string[];
}

/** Structured parse of the job description. */
export interface ParsedJD {
  title?: string;
  company?: string;
  seniority?: string;
  domain?: string;
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  tools: string[];
  qualifications: string[];
  ats_keywords: string[];
}

export interface TailoredResume {
  summary: string;
  experience: TailoredExperience[];
  verified_skills: string[];
  transferable_skills: string[];
  missing_requirements: string[];
  /** Per-requirement classification with evidence. */
  requirements?: ClassifiedRequirement[];
  parsed_resume?: ParsedResume;
  parsed_jd?: ParsedJD;
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

/** Is the cited evidence actually present in the source resume? */
export function evidenceIsReal(evidence: string | undefined, idx: SourceIndex): boolean {
  if (!evidence || evidence.trim().length < 8) return false;
  const norm = normalize(evidence).replace(/\s+/g, " ").trim();
  if (idx.text.replace(/\s+/g, " ").includes(norm)) return true;
  // Fall back to token overlap — models paraphrase whitespace/punctuation.
  const toks = tokenize(evidence).filter((t) => !STOPWORDS.has(t));
  if (!toks.length) return false;
  const hits = toks.filter((t) => idx.tokens.has(t) || idx.text.includes(t)).length;
  return hits / toks.length >= 0.7;
}

/** Classifies a requirement against the source resume when the model omits/overstates it. */
export function classifyRequirement(req: string, idx: SourceIndex): RequirementStatus {
  const toks = tokenize(req).filter((t) => !STOPWORDS.has(t));
  if (!toks.length) return "missing";
  const hits = toks.filter((t) => idx.tokens.has(t) || idx.text.includes(t)).length;
  const ratio = hits / toks.length;
  if (ratio >= 0.9) return "verified";
  if (ratio >= 0.4) return "transferable";
  return "missing";
}

/**
 * Validates a generated resume against the source resume.
 * - Bullets with fabricated metrics/certifications are rejected outright.
 * - Bullets whose cited evidence does not exist in the source are reverted to the
 *   original bullet (or rejected when there is no original).
 * - Substantially reworded bullets are flagged low confidence.
 * - Requirements are re-classified as verified / transferable / missing.
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

      const changed = !!bullet.original && bullet.original.trim() !== text.trim();
      const unknown = unsupportedTerms(text, idx);

      // Evidence link check — only enforced on bullets the model actually rewrote.
      if (changed && !evidenceIsReal(bullet.evidence || bullet.original, idx)) {
        rejectedCount++;
        if (bullet.original) {
          flaggedCount++;
          return {
            ...bullet,
            text: bullet.original,
            confidence: "high" as const,
            note: "Rewrite had no traceable evidence — original bullet kept.",
          };
        }
        return { ...bullet, rejected: true, confidence: "low" as const, reason: "No source evidence for this claim" };
      }

      if (unknown.length > 2) {
        flaggedCount++;
        return {
          ...bullet,
          confidence: "low" as const,
          note: `Wording changed substantially — verify: ${unknown.slice(0, 5).join(", ")}`,
        };
      }
      if (changed) {
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

  // Re-classify every requirement the model reported, demoting unsupported "verified" claims.
  const requirements: ClassifiedRequirement[] = (generated.requirements || []).map((r) => {
    const req = typeof r === "string" ? { requirement: r as unknown as string, status: "missing" as RequirementStatus } : r;
    const evidenceOk = evidenceIsReal(req.evidence, idx);
    const derived = classifyRequirement(req.requirement || "", idx);
    let status: RequirementStatus = req.status || derived;
    if (status === "verified" && !evidenceOk && derived !== "verified") status = derived;
    return { requirement: req.requirement, status, evidence: evidenceOk ? req.evidence : undefined };
  });

  // Any missing requirement must also surface in the missing list.
  const missingFromReqs = requirements.filter((r) => r.status === "missing").map((r) => r.requirement);
  const transferableFromReqs = requirements.filter((r) => r.status === "transferable").map((r) => r.requirement);

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

  const missing = Array.from(new Set([...(generated.missing_requirements || []), ...rejectedSkills, ...missingFromReqs]));
  const transferable = Array.from(
    new Set([...(generated.transferable_skills || []), ...transferableFromReqs])
  ).filter((t) => !missing.includes(t));

  return {
    resume: {
      summary,
      experience,
      verified_skills: verified.filter((s) => !missing.includes(s)),
      transferable_skills: transferable,
      missing_requirements: missing,
      requirements,
      parsed_resume: generated.parsed_resume,
      parsed_jd: generated.parsed_jd,
      changes_made: generated.changes_made || [],
      warnings,
    },
    rejectedCount,
    flaggedCount,
  };
}

export const TAILOR_SYSTEM_RULES = `You are a precision, evidence-first resume tailoring engine operating under STRICT truth boundaries.

WORKFLOW (follow in order):
1. Parse the SOURCE RESUME into structured data: titles, employers, dates, responsibilities, achievements, skills, tools, certifications, education, metrics.
2. Parse the JOB DESCRIPTION into: required skills, preferred skills, responsibilities, tools, seniority, domain, qualifications, ATS keywords.
3. Classify EVERY job requirement as:
   - "verified": directly supported by the resume (cite the exact source snippet as evidence).
   - "transferable": related experience but not an exact match.
   - "missing": no supporting evidence.
4. Only then tailor the resume.

HARD RULES:
- NEVER invent facts, metrics, employers, titles, dates, certifications, tools, or responsibilities.
- Preserve all original facts and numbers exactly. Never add a number that is not in the source.
- Use job-description keywords ONLY when they accurately describe verified experience. A skill in the JD does NOT mean the candidate has it.
- Preserve original job titles, company names, and employment dates EXACTLY.
- Keep unsupported requirements out of the resume body — they belong in missing_requirements.
- Preserve the original bullet verbatim when evidence is insufficient to rewrite it.

BULLET REWRITING (XYZ framework): "Accomplished X, measured by Y, by doing Z."
- Start with a strong action verb.
- State the task or problem.
- State the method, tools, or scope.
- Include a measurable result ONLY if the metric already exists in the source resume.
- If no metric exists, do NOT invent one — write an accurate scope-based bullet instead,
  e.g. "Built ETL pipelines using Python, Spark, and Airflow to support large-scale data processing."
- For every bullet, set "original" (the source bullet) and "evidence" (a verbatim snippet from the source resume that supports the claim), plus "confidence" ("high" = near-verbatim, "medium" = reframed, "low" = heavily reworded).

FORMATTING (the uploaded resume is the template):
- Preserve the uploaded resume's exact section names and their order. Do not rename or reorder them.
- Do NOT introduce headings such as "Contact Header", "Summary", "Skills", or "Professional Experience" unless that exact heading already exists in the uploaded resume.
- Do not create new sections. Only replace or improve content inside existing sections.
- Preserve the original contact/header block, bullet style, spacing, date formats and visual hierarchy.
- Analysis output (verified/transferable/missing skills, evidence, confidence) is for the analysis panel only — never part of the resume body.
- ATS-safe: single column, selectable plain text, no tables, graphics, icons, columns or text boxes.

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

JD keywords to use ONLY if evidence exists (otherwise classify as transferable or missing): ${(opts.missingKeywords || []).join(", ") || "none"}

Return JSON exactly in this shape:
{
  "parsed_resume": {
    "experience": [{"title":"","employer":"","dates":"","responsibilities":[],"achievements":[]}],
    "skills": [], "tools": [], "certifications": [],
    "education": [{"degree":"","institution":"","dates":""}],
    "metrics": []
  },
  "parsed_jd": {
    "title":"","company":"","seniority":"","domain":"",
    "required_skills": [], "preferred_skills": [], "responsibilities": [],
    "tools": [], "qualifications": [], "ats_keywords": []
  },
  "requirements": [{"requirement":"","status":"verified|transferable|missing","evidence":"verbatim source snippet or empty"}],
  "summary": "3-4 sentences, no invented facts, no new numbers",
  "experience": [{"title":"","company":"","dates":"","bullets":[{"text":"XYZ-format bullet","original":"source bullet","evidence":"verbatim source snippet","confidence":"high|medium|low"}]}],
  "verified_skills": [],
  "transferable_skills": [],
  "missing_requirements": [],
  "changes_made": [],
  "warnings": []
}`;
}

/**
 * Fallback plain-text renderer (resume content ONLY — no analysis output, no
 * invented headings beyond what is needed to separate roles). Prefer
 * `renderTailoredDocument` from resume-template.ts, which preserves the
 * uploaded resume's own sections and order.
 */
export function tailoredResumeToText(r: TailoredResume): string {
  const lines: string[] = [];
  if (r.summary) lines.push(r.summary, "");
  (r.experience || []).forEach((e) => {
    const head = [e.title, e.company].filter(Boolean).join(" - ") + (e.dates ? ` (${e.dates})` : "");
    if (head.trim()) lines.push(head);
    (e.bullets || []).filter((b) => !b.rejected).forEach((b) => lines.push(`- ${b.text}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}
