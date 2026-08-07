// ATS-safe exports: single column, selectable text, no graphics.
// Content is the template-rendered resume only — never analysis output.
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import type { RenderedResume } from "./resume-template";

const safeName = (name: string) =>
  name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) || "Resume";

export function downloadTailoredPdf(doc_: RenderedResume, fileBase: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const MARGIN = 18;
  const WIDTH = 210 - MARGIN * 2;
  let y = 20;

  const write = (text: string, opts: { bold?: boolean; size?: number }) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(20, 20, 20);
    for (const line of doc.splitTextToSize(text, WIDTH)) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, MARGIN, y);
      y += (opts.size ?? 10) * 0.52;
    }
  };

  doc_.header.forEach((l, i) => {
    if (!l.trim()) { y += 2; return; }
    write(l, { bold: i === 0, size: i === 0 ? 15 : 10 });
  });
  y += 3;

  doc_.sections.forEach((s) => {
    if (y > 265) { doc.addPage(); y = 20; }
    if (s.name) { write(s.name, { bold: true, size: 11 }); y += 1; }
    s.lines.forEach((l) => {
      if (!l.trim()) { y += 2; return; }
      write(l, { size: 10 });
    });
    y += 4;
  });

  doc.save(`${safeName(fileBase)}.pdf`);
}

export async function downloadTailoredDocx(doc_: RenderedResume, fileBase: string) {
  const paras: Paragraph[] = [];

  doc_.header.forEach((l, i) =>
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: l, bold: i === 0, size: i === 0 ? 30 : 20, font: "Arial" })],
      })
    )
  );
  if (doc_.header.length) paras.push(new Paragraph({ children: [new TextRun({ text: "", font: "Arial" })] }));

  doc_.sections.forEach((s) => {
    if (s.name) {
      paras.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: s.name, bold: true, size: 22, font: "Arial" })],
        })
      );
    }
    s.lines.forEach((l) =>
      paras.push(new Paragraph({ children: [new TextRun({ text: l, size: 20, font: "Arial" })] }))
    );
  });

  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        children: paras,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const a = document_link(url, `${safeName(fileBase)}.docx`);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

function document_link(url: string, name: string) {
  const a = window.document.createElement("a");
  a.href = url;
  a.download = name;
  window.document.body.appendChild(a);
  return a;
}
