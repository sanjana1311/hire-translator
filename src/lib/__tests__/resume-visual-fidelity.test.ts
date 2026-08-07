import { describe, expect, it } from "vitest";
import { buildFormattedDocument, layoutSignature } from "@/lib/resume-document";
import { layoutFromPlainText, type ResumeLayout } from "@/lib/resume-layout";
import type { TailoredResume } from "@/lib/resume-guard";

/** Synthetic capture of an uploaded resume: mixed fonts, sizes, indents, 2 pages. */
const uploaded: ResumeLayout = {
  version: 1,
  pages: [
    { width: 612, height: 792 },
    { width: 612, height: 792 },
  ],
  margins: { left: 54, right: 54, top: 52, bottom: 54 },
  baseFont: "Garamond",
  baseSize: 10.5,
  lines: [
    line("Jordan Reyes", { size: 18, bold: true, align: "center", y: 52, font: "Garamond" }),
    line("jordan@mail.com | 555-0100 | Seattle, WA", { size: 9, align: "center", y: 72, spaceBefore: 20 }),
    line("EXPERIENCE", { size: 11.5, bold: true, heading: true, y: 100, spaceBefore: 28 }),
    line("Data Analyst, Northwind", { size: 10.5, bold: true, y: 116, spaceBefore: 16 }),
    line("Jan 2022 – Present", { size: 9, italic: true, align: "right", indent: 380, y: 116, spaceBefore: 0 }),
    bullet("Built dashboards used by the ops team to track weekly throughput", { y: 132, indent: 14 }),
    bullet("Cleaned a 2M row dataset and cut reporting time by 40%", { y: 146, indent: 14 }),
    line("EDUCATION", { size: 11.5, bold: true, heading: true, y: 176, spaceBefore: 30, page: 1 }),
    line("B.S. Statistics, University of Washington", { size: 10.5, y: 192, spaceBefore: 16, page: 1 }),
  ],
};

function line(
  text: string,
  o: Partial<{ size: number; bold: boolean; italic: boolean; align: "left" | "center" | "right"; y: number; indent: number; spaceBefore: number; heading: boolean; font: string; page: number }> = {}
) {
  const size = o.size ?? 10.5;
  return {
    text,
    runs: [{ text, bold: !!o.bold, italic: !!o.italic, size, font: o.font ?? "Garamond" }],
    x: 54 + (o.indent ?? 0),
    y: o.y ?? 0,
    indent: o.indent ?? 0,
    spaceBefore: o.spaceBefore ?? 14,
    align: o.align ?? ("left" as const),
    bullet: null,
    heading: !!o.heading,
    page: o.page ?? 0,
  };
}

function bullet(body: string, o: { y: number; indent: number }) {
  const text = `• ${body}`;
  return { ...line(text, { ...o, size: 10.5 }), bullet: "•" };
}

const tailored: TailoredResume = {
  summary: "",
  experience: [
    {
      title: "Data Analyst",
      company: "Northwind",
      dates: "Jan 2022 – Present",
      bullets: [
        {
          text: "Delivered ops dashboards adopted by 40 weekly users, by rebuilding the throughput tracking pipeline",
          original: "Built dashboards used by the ops team to track weekly throughput",
        },
        {
          text: "Reduced reporting time 40%, measured across a 2M row dataset, by automating the cleaning workflow",
          original: "Cleaned a 2M row dataset and cut reporting time by 40%",
        },
      ],
    },
  ],
} as unknown as TailoredResume;

describe("visual comparison: tailored resume vs uploaded resume", () => {
  const doc = buildFormattedDocument(tailored, { layout: uploaded });

  it("keeps an identical formatting signature (fonts, sizes, weights, indents, alignment, bullets, page breaks)", () => {
    expect(layoutSignature(doc)).toEqual(layoutSignature(uploaded));
  });

  it("preserves section headings, their order and the header block verbatim", () => {
    expect(doc.lines.filter((l) => l.heading).map((l) => l.text)).toEqual(["EXPERIENCE", "EDUCATION"]);
    expect(doc.lines[0].text).toBe("Jordan Reyes");
    expect(doc.lines[1].text).toBe("jordan@mail.com | 555-0100 | Seattle, WA");
  });

  it("preserves dates, alignment and italics on the date line", () => {
    const date = doc.lines.find((l) => l.text.includes("Jan 2022"))!;
    expect(date.align).toBe("right");
    expect(date.runs[0].italic).toBe(true);
    expect(date.indent).toBe(380);
  });

  it("preserves page breaks", () => {
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[1].map((l) => l.text)).toEqual([
      "EDUCATION",
      "B.S. Statistics, University of Washington",
    ]);
  });

  it("replaces only bullet content, keeping the original glyph and indent", () => {
    const bullets = doc.lines.filter((l) => l.bullet);
    expect(bullets).toHaveLength(2);
    bullets.forEach((b) => {
      expect(b.bullet).toBe("•");
      expect(b.indent).toBe(14);
      expect(b.text.startsWith("• ")).toBe(true);
      expect(b.replaced).toBe(true);
    });
    expect(bullets[0].text).toContain("Delivered ops dashboards");
    expect(bullets[1].text).toContain("Reduced reporting time 40%");
  });

  it("never inserts analysis labels or new headings into the document", () => {
    expect(doc.text).not.toMatch(/verified skills|transferable skills|missing requirements|confidence|evidence/i);
    expect(doc.lines.length).toBe(uploaded.lines.length);
  });

  it("produces ATS-safe single-column selectable text", () => {
    expect(doc.text).toContain("Jordan Reyes");
    expect(doc.text).toContain("EXPERIENCE");
    expect(doc.text.split("\n").every((l) => !/\t{2,}/.test(l))).toBe(true);
  });

  it("falls back to a plain-text layout when no visual capture exists", () => {
    const fallback = buildFormattedDocument(tailored, {
      rawText: "Jordan Reyes\njordan@mail.com\n\nEXPERIENCE\n• Built dashboards used by the ops team to track weekly throughput\n",
    });
    expect(fallback.lines.some((l) => l.heading && l.text === "EXPERIENCE")).toBe(true);
    expect(layoutSignature(fallback)).toHaveLength(
      layoutFromPlainText("Jordan Reyes\njordan@mail.com\n\nEXPERIENCE\n• x\n").lines.length
    );
  });
});
