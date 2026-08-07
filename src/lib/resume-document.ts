// The single formatted document model shared by the preview, the PDF export and
// the DOCX export. Content comes from the tailored resume; *every* formatting
// attribute comes from the uploaded resume's captured layout.

import type { TailoredResume, TailoredBullet } from "./resume-guard";
import {
  BULLET_RE,
  isUsableLayout,
  layoutFromPlainText,
  type LayoutLine,
  type ResumeLayout,
} from "./resume-layout";

export interface FormattedLine extends LayoutLine {
  /** True when the AI rewrite replaced the source text of this line. */
  replaced: boolean;
}

export interface FormattedDocument {
  layout: ResumeLayout;
  lines: FormattedLine[];
  /** Lines grouped by source page, preserving page breaks. */
  pages: FormattedLine[][];
  /** ATS-safe plain text (single column, selectable, resume content only). */
  text: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function overlap(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!A.size) return 0;
  let hits = 0;
  A.forEach((w) => {
    if (B.has(w)) hits++;
  });
  return hits / A.size;
}

function acceptedBullets(resume: TailoredResume): TailoredBullet[] {
  return (resume.experience || []).flatMap((e) => e.bullets || []).filter((b) => !b.rejected && b.text);
}

/** Rewrites a run sequence to carry new text while keeping the line's styling. */
function restyle(line: LayoutLine, newText: string): FormattedLine {
  const glyph = line.bullet ? `${line.bullet} ` : "";
  const body = newText.replace(BULLET_RE, "").trim();
  const dominant =
    [...line.runs].sort((a, b) => b.text.length - a.text.length)[0] ?? line.runs[0];
  return {
    ...line,
    text: `${glyph}${body}`,
    runs: [{ ...dominant, text: `${glyph}${body}` }],
    replaced: true,
  };
}

/**
 * Builds the formatted document: the uploaded resume's visual template with
 * tailored content swapped in. Headings, header block, dates, alignment,
 * indentation, fonts and page breaks are never modified, and no analysis
 * labels (verified/transferable/missing/confidence) are ever inserted.
 */
export function buildFormattedDocument(
  resume: TailoredResume,
  source: { layout?: unknown; rawText?: string }
): FormattedDocument {
  const layout: ResumeLayout = isUsableLayout(source.layout)
    ? source.layout
    : layoutFromPlainText(source.rawText || "");

  const bullets = acceptedBullets(resume);
  const used = new Set<TailoredBullet>();

  const lines: FormattedLine[] = layout.lines.map((line) => {
    if (line.heading) return { ...line, replaced: false };

    if (line.bullet) {
      const body = line.text.replace(BULLET_RE, "").trim();
      let best: TailoredBullet | null = null;
      let bestScore = 0;
      for (const b of bullets) {
        if (used.has(b)) continue;
        const score = Math.max(overlap(b.original || "", body), overlap(body, b.original || b.text));
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (best && bestScore >= 0.55) {
        used.add(best);
        return restyle(line, best.text);
      }
    }
    return { ...line, replaced: false };
  });

  // Summary paragraph: replace the body line(s) directly under a summary heading.
  if (resume.summary?.trim()) {
    const hIdx = lines.findIndex(
      (l) => l.heading && /summary|profile|objective|about/i.test(l.text)
    );
    if (hIdx >= 0) {
      const bodyIdx: number[] = [];
      for (let i = hIdx + 1; i < lines.length && !lines[i].heading && !lines[i].bullet; i++) bodyIdx.push(i);
      if (bodyIdx.length) {
        lines[bodyIdx[0]] = restyle(lines[bodyIdx[0]], resume.summary.trim());
        for (let i = 1; i < bodyIdx.length; i++) lines[bodyIdx[i]] = { ...lines[bodyIdx[i]], text: "", runs: [], replaced: true };
      }
    }
  }

  const kept = lines.filter((l) => l.text.trim());
  const pageCount = Math.max(1, ...kept.map((l) => l.page + 1));
  const pages: FormattedLine[][] = Array.from({ length: pageCount }, (_, p) =>
    kept.filter((l) => l.page === p)
  );

  const text = pages
    .map((page) =>
      page
        .map((l, i) => (i > 0 && (l.heading || l.spaceBefore > l.runs[0]?.size * 1.9) ? `\n${l.text}` : l.text))
        .join("\n")
    )
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { layout, lines: kept, pages, text };
}

/** Plain text of a single page-agnostic section (heading + following body). */
export function sectionsOf(doc: FormattedDocument): { name: string; lines: FormattedLine[]; text: string }[] {
  const out: { name: string; lines: FormattedLine[]; text: string }[] = [];
  let current: { name: string; lines: FormattedLine[]; text: string } | null = null;
  for (const line of doc.lines) {
    if (line.heading) {
      current = { name: line.text, lines: [], text: "" };
      out.push(current);
    } else if (current) current.lines.push(line);
    else {
      if (!out.length || out[0].name !== "") out.unshift({ name: "", lines: [], text: "" });
      out[0].lines.push(line);
    }
  }
  out.forEach((s) => {
    s.text = [s.name, ...s.lines.map((l) => l.text)].filter(Boolean).join("\n");
  });
  return out;
}

/**
 * Compact fingerprint of a document's visual formatting, used by the visual
 * comparison test to prove the tailored output keeps the uploaded layout.
 */
export function layoutSignature(input: ResumeLayout | FormattedDocument): string[] {
  const lines: LayoutLine[] = "lines" in input ? (input as any).lines : [];
  return lines
    .filter((l) => l.text.trim())
    .map((l) => {
      const r = l.runs[0] ?? { size: 0, bold: false, italic: false, font: "" };
      return [
        `p${l.page}`,
        `s${r.size}`,
        `f${r.font}`,
        r.bold ? "B" : "-",
        r.italic ? "I" : "-",
        `i${Math.round(l.indent / 4)}`,
        l.align[0],
        l.bullet ? `b${l.bullet}` : "b-",
        l.heading ? "H" : "-",
        `g${Math.round(l.spaceBefore / 3)}`,
      ].join(":");
    });
}
