// Treats the uploaded resume as the formatting template.
// Section names, order, header layout, bullet glyphs and date formats are preserved;
// only the content inside existing sections is swapped for tailored content.

import type { TailoredResume, TailoredBullet } from "./resume-guard";

export interface TemplateSection {
  /** Exact heading text as written in the uploaded resume. */
  name: string;
  /** Raw body lines under the heading (verbatim). */
  lines: string[];
  /** Bullet glyph used in this section, if any (e.g. "•", "-", "*"). */
  bullet: string | null;
}

export interface ResumeTemplate {
  /** Lines before the first heading — contact/header block, kept verbatim. */
  header: string[];
  sections: TemplateSection[];
  /** True when at least one heading was detected. */
  hasStructure: boolean;
}

const BULLET_RE = /^\s*([•▪◦‣·*\u2013\u2014-])\s+/;

function isBullet(line: string) {
  return BULLET_RE.test(line);
}

function bulletGlyph(line: string): string | null {
  const m = line.match(BULLET_RE);
  return m ? m[1] : null;
}

/** Heading heuristic: short, no trailing period, not a bullet, mostly caps or a known label. */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 48 || isBullet(t)) return false;
  if (/[.;]$/.test(t)) return false;
  if (/\d{4}/.test(t) && !/^[A-Z\s&/]+$/.test(t)) return false; // date lines
  if (/@|https?:\/\/|www\./i.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upperRatio = letters.split("").filter((c) => c === c.toUpperCase()).length / letters.length;
  if (upperRatio > 0.85) return true;
  // Title Case single-line label with <= 4 words
  const words = t.split(/\s+/);
  if (words.length <= 4 && words.every((w) => /^[A-Z][a-zA-Z&/]*$/.test(w) || /^(of|and|&)$/i.test(w))) return true;
  return false;
}

export function extractTemplate(rawText: string): ResumeTemplate {
  const lines = (rawText || "").replace(/\r/g, "").split("\n");
  const header: string[] = [];
  const sections: TemplateSection[] = [];
  let current: TemplateSection | null = null;

  for (const line of lines) {
    if (isHeading(line)) {
      current = { name: line.trim(), lines: [], bullet: null };
      sections.push(current);
      continue;
    }
    if (!current) header.push(line);
    else {
      current.lines.push(line);
      if (!current.bullet && isBullet(line)) current.bullet = bulletGlyph(line);
    }
  }

  // The name line at the very top is part of the contact/header block, not a section.
  if (!header.length && sections.length) {
    const first = sections[0];
    const looksLikeContact = first.lines.some((l) => /@|https?:\/\/|www\.|\d{3}[).\-\s]\d{3}/i.test(l));
    const isCapsHeading = first.name === first.name.toUpperCase();
    if (looksLikeContact || !isCapsHeading) {
      sections.shift();
      header.push(first.name, ...first.lines);
    }
  }

  return {
    header: trimBlank(header),
    sections: sections.map((s) => ({ ...s, lines: trimBlank(s.lines) })),
    hasStructure: sections.length > 0,
  };
}

function trimBlank(arr: string[]) {
  const out = [...arr];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function overlap(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!A.size) return 0;
  let hits = 0;
  A.forEach((w) => { if (B.has(w)) hits++; });
  return hits / A.size;
}

/** Flat list of accepted tailored bullets keyed by their original source text. */
function tailoredBullets(resume: TailoredResume): TailoredBullet[] {
  return (resume.experience || []).flatMap((e) => e.bullets || []).filter((b) => !b.rejected && b.text);
}

/** Replaces a source bullet line with its tailored rewrite, keeping the original glyph and indent. */
function rewriteLine(line: string, bullets: TailoredBullet[]): string {
  const glyph = line.match(BULLET_RE);
  if (!glyph) return line;
  const body = line.replace(BULLET_RE, "").trim();
  if (!body) return line;
  let best: TailoredBullet | null = null;
  let bestScore = 0;
  for (const b of bullets) {
    const score = Math.max(overlap(b.original || "", body), overlap(body, b.original || b.text));
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (best && bestScore >= 0.6) {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    return `${indent}${glyph[1]} ${best.text}`;
  }
  return line;
}

export interface RenderedSection {
  name: string;
  /** Section body lines, tailored where evidence allowed it. */
  lines: string[];
  text: string;
}

export interface RenderedResume {
  header: string[];
  sections: RenderedSection[];
  text: string;
}

/**
 * Renders the tailored resume using the uploaded resume as the template.
 * No headings are invented: only sections that exist in the upload are emitted,
 * in their original order and with their original names. Analysis output
 * (verified/transferable/missing skills, evidence, confidence) is never included.
 */
export function renderWithTemplate(template: ResumeTemplate, resume: TailoredResume): RenderedResume {
  const bullets = tailoredBullets(resume);
  const sections: RenderedSection[] = template.sections.map((s) => {
    const lines = s.lines.map((l) => rewriteLine(l, bullets));
    return { name: s.name, lines, text: [s.name, ...lines].join("\n").trim() };
  });
  const text = [...template.header, "", ...sections.map((s) => s.text)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { header: template.header, sections, text };
}

/** Fallback renderer when the upload has no detectable headings: resume content only. */
export function renderWithoutTemplate(resume: TailoredResume): RenderedResume {
  const sections: RenderedSection[] = [];
  if (resume.summary) sections.push({ name: "", lines: [resume.summary], text: resume.summary });
  (resume.experience || []).forEach((e) => {
    const head = [e.title, e.company].filter(Boolean).join(" — ") + (e.dates ? ` (${e.dates})` : "");
    const lines = [head, ...(e.bullets || []).filter((b) => !b.rejected).map((b) => `• ${b.text}`)];
    sections.push({ name: "", lines, text: lines.join("\n") });
  });
  const text = sections.map((s) => s.text).join("\n\n").trim();
  return { header: [], sections, text };
}

export function renderTailoredDocument(resume: TailoredResume, sourceResumeText: string): RenderedResume {
  const template = extractTemplate(sourceResumeText);
  return template.hasStructure ? renderWithTemplate(template, resume) : renderWithoutTemplate(resume);
}
