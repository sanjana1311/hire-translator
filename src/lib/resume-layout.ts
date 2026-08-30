// Visual layout model of the uploaded resume.
//
// The uploaded file is treated as a *visual* template: font family/size, weight,
// italics, indentation, alignment, bullet glyphs, line spacing, margins and page
// breaks are captured here once at upload time and re-used for the preview and
// for every export, so all three render from the same formatted document model.

export interface LayoutRun {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Point size as measured in the source document. */
  size: number;
  /** Font family as measured in the source document (best effort). */
  font: string;
}

export type LineAlign = "left" | "center" | "right";

export interface LayoutLine {
  /** Concatenated plain text of the line. */
  text: string;
  runs: LayoutRun[];
  /** Distance from the left page edge, in points. */
  x: number;
  /** Distance from the top page edge, in points. */
  y: number;
  /** Left indent relative to the body margin, in points. */
  indent: number;
  /** Vertical gap above this line, in points. */
  spaceBefore: number;
  align: LineAlign;
  /** Bullet glyph when the line is a list item. */
  bullet: string | null;
  /** Heuristic: this line is a section heading. */
  heading: boolean;
  /** 0-based page index in the source document. */
  page: number;
}

export interface PageGeometry {
  width: number;
  height: number;
}

export interface ResumeLayout {
  version: 1;
  pages: PageGeometry[];
  /** Left/right/top margins in points, derived from content bounds. */
  margins: { left: number; right: number; top: number; bottom: number };
  lines: LayoutLine[];
  /** Dominant body font family + size. */
  baseFont: string;
  baseSize: number;
}

export const BULLET_RE = /^\s*([•▪◦‣·●○*\u2013\u2014-])\s+/;

const BOLD_RE = /(bold|black|heavy|semib|demi|[-_,]bd\b)/i;
const ITALIC_RE = /(italic|oblique|[-_,]it\b)/i;

function familyOf(raw: string): string {
  const name = (raw || "").replace(/^[A-Z]{6}\+/, "");
  const base = name.split(/[-,_]/)[0] || "";
  if (/times|serif|georgia|garamond|book/i.test(name)) return base || "Times New Roman";
  if (/courier|mono/i.test(name)) return base || "Courier New";
  return base || "Helvetica";
}

/**
 * Extracts the visual layout of a PDF using pdf.js text positioning.
 * Underlines are not recoverable from the text layer and are best-effort only.
 */
export async function extractPdfLayout(file: File | ArrayBuffer): Promise<ResumeLayout> {
  const pdfjsLib: any = await import("pdfjs-dist");
  // @ts-expect-error vite worker url import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  const pages: PageGeometry[] = [];
  const rawLines: LayoutLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();
    const styles = content.styles || {};

    // Group items into visual lines by baseline y.
    const buckets: { y: number; items: any[] }[] = [];
    for (const item of content.items as any[]) {
      if (!("str" in item) || !item.str) continue;
      const tr = item.transform;
      const y = viewport.height - tr[5];
      const bucket = buckets.find((b) => Math.abs(b.y - y) < 3.2);
      if (bucket) bucket.items.push(item);
      else buckets.push({ y, items: [item] });
    }
    buckets.sort((a, b) => a.y - b.y);

    for (const b of buckets) {
      b.items.sort((i: any, j: any) => i.transform[4] - j.transform[4]);
      const runs: LayoutRun[] = [];
      let prevEnd: number | null = null;
      for (const item of b.items) {
        const style = styles[item.fontName] || {};
        const rawFont: string = style.fontFamily || item.fontName || "";
        const size = Math.hypot(item.transform[2], item.transform[3]) || style.fontSize || 10;
        const gap = prevEnd !== null ? item.transform[4] - prevEnd : 0;
        const text = (gap > size * 0.28 ? " " : "") + item.str;
        prevEnd = item.transform[4] + (item.width || 0);
        const run: LayoutRun = {
          text,
          bold: BOLD_RE.test(rawFont),
          italic: ITALIC_RE.test(rawFont),
          size: Math.round(size * 10) / 10,
          font: familyOf(rawFont),
        };
        const last = runs[runs.length - 1];
        if (last && last.bold === run.bold && last.italic === run.italic && last.size === run.size && last.font === run.font) {
          last.text += run.text;
        } else runs.push(run);
      }
      const text = runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const first = b.items[0];
      const lastItem = b.items[b.items.length - 1];
      const x = first.transform[4];
      const right = lastItem.transform[4] + (lastItem.width || 0);
      rawLines.push({
        text,
        runs,
        x,
        y: b.y,
        indent: 0,
        spaceBefore: 0,
        align: "left",
        bullet: text.match(BULLET_RE)?.[1] ?? null,
        heading: false,
        page: p - 1,
      });
      (rawLines[rawLines.length - 1] as any)._right = right;
      (rawLines[rawLines.length - 1] as any)._pageWidth = viewport.width;
    }
  }

  return finalizeLayout(rawLines, pages);
}

function finalizeLayout(lines: LayoutLine[], pages: PageGeometry[]): ResumeLayout {
  const pageWidth = pages[0]?.width ?? 612;
  const pageHeight = pages[0]?.height ?? 792;
  const left = lines.length ? Math.min(...lines.map((l) => l.x)) : 54;
  const rightEdge = lines.length ? Math.max(...lines.map((l) => (l as any)._right ?? l.x)) : pageWidth - 54;
  const top = lines.length ? Math.min(...lines.map((l) => l.y)) : 54;
  const bottom = pageHeight - (lines.length ? Math.max(...lines.map((l) => l.y)) : pageHeight - 54);

  // Dominant body size/font
  const tally = new Map<string, number>();
  lines.forEach((l) => l.runs.forEach((r) => tally.set(`${r.font}|${r.size}`, (tally.get(`${r.font}|${r.size}`) ?? 0) + r.text.length)));
  const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Helvetica|10";
  const [baseFont, baseSizeStr] = dominant.split("|");
  const baseSize = Number(baseSizeStr) || 10;

  const centerX = (left + rightEdge) / 2;

  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    l.indent = Math.max(0, Math.round((l.x - left) * 10) / 10);
    l.spaceBefore = prev && prev.page === l.page ? Math.max(0, Math.round((l.y - prev.y) * 10) / 10) : 0;
    const right = (l as any)._right ?? l.x;
    const lineCenter = (l.x + right) / 2;
    if (Math.abs(lineCenter - centerX) < 14 && l.indent > 18) l.align = "center";
    else if (right > rightEdge - 6 && l.indent > 120) l.align = "right";
    else l.align = "left";
    const maxSize = Math.max(...l.runs.map((r) => r.size));
    const allBold = l.runs.every((r) => r.bold);
    const alpha = l.text.replace(/[^A-Za-z]/g, "");
    const caps = alpha.length > 2 && alpha === alpha.toUpperCase();
    l.heading =
      !l.bullet &&
      l.text.length <= 60 &&
      (caps || allBold || maxSize > baseSize + 1.2) &&
      !/@|https?:\/\//i.test(l.text);
    delete (l as any)._right;
    delete (l as any)._pageWidth;
  });

  return { version: 1, pages, margins: { left, right: pageWidth - rightEdge, top, bottom }, lines, baseFont, baseSize };
}

/**
 * Fallback layout built from plain text when no PDF layout was captured
 * (older uploads, DOCX-sourced text). Keeps section order and bullet glyphs.
 */
export function layoutFromPlainText(raw: string): ResumeLayout {
  const src = (raw || "").replace(/\r/g, "").split("\n");
  const lines: LayoutLine[] = [];
  let y = 54;
  src.forEach((line) => {
    const text = line.trim();
    if (!text) {
      y += 6;
      return;
    }
    const bullet = text.match(BULLET_RE)?.[1] ?? null;
    const alpha = text.replace(/[^A-Za-z]/g, "");
    const heading = !bullet && text.length <= 48 && alpha.length > 2 && alpha === alpha.toUpperCase();
    const size = heading ? 11.5 : 10;
    const indent = bullet ? 14 : 0;
    lines.push({
      text,
      runs: [{ text, bold: heading, italic: false, size, font: "Helvetica" }],
      x: 54 + indent,
      y,
      indent,
      spaceBefore: heading ? 14 : 12.5,
      align: "left",
      bullet,
      heading,
      page: 0,
    });
    y += heading ? 16 : 13;
  });
  // First non-empty line of a plain-text resume is the name.
  if (lines[0]) {
    lines[0].heading = false;
    lines[0].runs = [{ ...lines[0].runs[0], bold: true, size: 15 }];
  }
  return {
    version: 1,
    pages: [{ width: 612, height: 792 }],
    margins: { left: 54, right: 54, top: 54, bottom: 54 },
    lines,
    baseFont: "Helvetica",
    baseSize: 10,
  };
}

export function isUsableLayout(layout: unknown): layout is ResumeLayout {
  const l = layout as ResumeLayout | null;
  return !!l && (l as any).version === 1 && Array.isArray(l.lines) && l.lines.length > 3;
}

/**
 * Merges visually wrapped continuation lines back into one logical line.
 *
 * A PDF stores each *visual* row separately, so a bullet that wraps over three
 * rows arrives as three lines. Without merging, rewriting only replaces the
 * first row and the leftover rows stay in the document as orphan fragments.
 */
export function mergeWrappedLines(layout: ResumeLayout): ResumeLayout {
  const out: LayoutLine[] = [];
  for (const line of layout.lines) {
    const prev = out[out.length - 1];
    const size = prev?.runs[0]?.size ?? layout.baseSize;
    const isContinuation =
      !!prev &&
      prev.page === line.page &&
      !prev.heading &&
      !line.heading &&
      !line.bullet &&
      line.align === "left" &&
      prev.align !== "right" &&
      line.spaceBefore > 0 &&
      // only a line that filled its column can have wrapped
      prev.text.trim().length >= 60 &&
      line.spaceBefore <= size * 1.75 &&
      // wrapped rows sit at, or hanging-indented from, the parent line
      Math.abs(line.indent - prev.indent) <= Math.max(18, size * 1.6) &&
      // a genuinely new paragraph normally starts a new sentence
      (!/[.!?:;]$/.test(prev.text.trim()) || /^[a-z(]/.test(line.text.trim()));

    if (isContinuation) {
      const joiner = /[-\u2013\u2014]$/.test(prev.text) ? "" : " ";
      prev.text = `${prev.text}${joiner}${line.text}`.replace(/\s+/g, " ").trim();
      const last = prev.runs[prev.runs.length - 1];
      line.runs.forEach((r, i) => {
        const text = i === 0 ? `${joiner}${r.text}` : r.text;
        if (last && last.bold === r.bold && last.italic === r.italic && last.size === r.size && last.font === r.font) {
          last.text += text;
        } else prev.runs.push({ ...r, text });
      });
      continue;
    }
    out.push({ ...line, runs: line.runs.map((r) => ({ ...r })) });
  }
  return { ...layout, lines: out };
}

