// ATS-safe exports rendered from the same FormattedDocument as the preview.
// DOCX is the primary, template-preserving format; PDF is a best-effort recreation.
// Both are single-column, selectable text, with no analysis labels.
import jsPDF from "jspdf";
import {
  AlignmentType,
  Document,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { FormattedDocument, FormattedLine } from "./resume-document";

const safeName = (name: string) =>
  name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) || "Resume";

const PT_TO_TWIP = 20;

function pdfFamily(font: string): "helvetica" | "times" | "courier" {
  if (/times|serif|georgia|garamond|book|minion|cambria/i.test(font)) return "times";
  if (/courier|mono|consol/i.test(font)) return "courier";
  return "helvetica";
}

// jsPDF's built-in fonts only cover WinAnsi. Anything outside it (arrows, math
// symbols, emoji, Wingdings bullets from the source PDF) renders as mojibake,
// so map it to a readable equivalent before drawing.
const PDF_CHAR_MAP: Record<string, string> = {
  "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21d2": "=>",
  "\u2265": ">=", "\u2264": "<=", "\u2260": "!=", "\u2248": "~",
  "\u2022": "\u2022", "\u2023": "\u2022", "\u25aa": "\u2022", "\u25cf": "\u2022",
  "\u25a0": "\u2022", "\u25e6": "\u2022", "\u00b7": "\u2022", "\uf0a7": "\u2022",
  "\uf0b7": "\u2022", "\uf0a8": "\u2022", "\uf076": "\u2022", "\uf0fc": "\u2022",
  "\u2713": "\u2022", "\u2714": "\u2022", "\u2026": "...", "\u2032": "'",
  "\u2033": '"', "\u00a0": " ", "\u200b": "", "\ufeff": "",
};

/** Characters above U+00FF that WinAnsi (and therefore jsPDF) still renders. */
const WINANSI_EXTRA = new Set(
  "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178".split("")
);

export function pdfSafeText(input: string): string {
  return Array.from(input || "")
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code <= 0xff) return ch;
      if (PDF_CHAR_MAP[ch] !== undefined) return PDF_CHAR_MAP[ch];
      if (WINANSI_EXTRA.has(ch)) return ch;
      if (code >= 0x2010 && code <= 0x2015) return "-";
      // Emoji, pictographs, private-use icons: drop them rather than print junk.
      return "";
    })
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}



/** Best-effort PDF recreation: absolute positioning from the captured layout. */
export function downloadTailoredPdf(doc_: FormattedDocument, fileBase: string) {
  const geo = doc_.layout.pages[0] ?? { width: 612, height: 792 };
  const pdf = new jsPDF({ unit: "pt", format: [geo.width, geo.height] });
  const { left, right } = doc_.layout.margins;
  const contentWidth = geo.width - left - right;

  doc_.pages.forEach((page, pi) => {
    if (pi > 0) pdf.addPage([geo.width, geo.height]);
    let drift = 0; // vertical shift caused by wrapped lines
    page.forEach((line) => {
      const run = line.runs[0] ?? { size: doc_.layout.baseSize, bold: false, italic: false, font: doc_.layout.baseFont };
      const style = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
      pdf.setFont(pdfFamily(run.font), style);
      pdf.setFontSize(run.size);
      pdf.setTextColor(17, 17, 17);

      const available = contentWidth - line.indent;
      const safe = pdfSafeText(line.text);
      if (!safe) return;
      const wrapped: string[] = pdf.splitTextToSize(safe, Math.max(80, available));

      let y = line.y + drift;
      wrapped.forEach((seg, i) => {
        if (y > geo.height - doc_.layout.margins.bottom + run.size) {
          pdf.addPage([geo.width, geo.height]);
          drift -= y - (doc_.layout.margins.top + run.size);
          y = doc_.layout.margins.top + run.size;
        }
        const hang = i > 0 && line.bullet ? run.size * 0.9 : 0;
        const x = line.x + hang;
        if (line.align === "center") pdf.text(seg, geo.width / 2, y, { align: "center" });
        else if (line.align === "right") pdf.text(seg, geo.width - right, y, { align: "right" });
        else pdf.text(seg, x, y);
        if (i < wrapped.length - 1) {
          y += run.size * 1.18;
          drift += run.size * 1.18;
        }
      });
    });
  });

  pdf.save(`${safeName(fileBase)}.pdf`);
}

function toParagraph(line: FormattedLine, isFirstOnPage: boolean, pageBreak: boolean): Paragraph {
  const runs = (line.runs.length ? line.runs : [{ text: line.text, bold: false, italic: false, size: 10, font: "Helvetica" }]).map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        size: Math.round(r.size * 2),
        font: r.font,
      })
  );
  const children: (TextRun | PageBreak)[] = pageBreak ? [new PageBreak(), ...runs] : runs;
  const hanging = line.bullet ? Math.round(line.runs[0]?.size ?? 10) * PT_TO_TWIP * 0.9 : 0;
  return new Paragraph({
    alignment:
      line.align === "center" ? AlignmentType.CENTER : line.align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    indent: {
      left: Math.round(line.indent * PT_TO_TWIP),
      hanging: Math.round(hanging),
    },
    spacing: {
      before: isFirstOnPage ? 0 : Math.round(Math.max(0, line.spaceBefore - (line.runs[0]?.size ?? 10) * 1.15) * PT_TO_TWIP),
      line: Math.round((line.runs[0]?.size ?? 10) * 1.15 * PT_TO_TWIP),
    },
    children,
  });
}

/** Primary export: preserves fonts, sizes, weights, indents, alignment and page breaks. */
export async function downloadTailoredDocx(doc_: FormattedDocument, fileBase: string) {
  const geo = doc_.layout.pages[0] ?? { width: 612, height: 792 };
  const m = doc_.layout.margins;

  const paras: Paragraph[] = [];
  doc_.pages.forEach((page, pi) => {
    page.forEach((line, li) => paras.push(toParagraph(line, li === 0, pi > 0 && li === 0)));
  });

  const document = new Document({
    styles: {
      default: {
        document: { run: { font: doc_.layout.baseFont, size: Math.round(doc_.layout.baseSize * 2) } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(geo.width * PT_TO_TWIP), height: Math.round(geo.height * PT_TO_TWIP) },
            margin: {
              top: Math.round(Math.max(m.top - (doc_.layout.baseSize || 10), 36) * PT_TO_TWIP),
              bottom: Math.round(Math.max(m.bottom, 36) * PT_TO_TWIP),
              left: Math.round(Math.max(m.left, 36) * PT_TO_TWIP),
              right: Math.round(Math.max(m.right, 36) * PT_TO_TWIP),
            },
          },
        },
        children: paras,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = `${safeName(fileBase)}.docx`;
  window.document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}
