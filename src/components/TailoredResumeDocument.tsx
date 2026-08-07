import { useMemo, useState } from "react";
import { Copy, Check, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import type { TailoredResume } from "@/lib/resume-guard";
import { buildFormattedDocument, sectionsOf } from "@/lib/resume-document";
import { downloadTailoredPdf, downloadTailoredDocx } from "@/lib/resume-export";

interface Props {
  resume: TailoredResume;
  sourceResumeText: string;
  /** Captured visual layout of the uploaded PDF (fonts, geometry, page breaks). */
  sourceLayout?: unknown;
  fileBase: string;
}

const cssFamily = (font: string) => {
  if (/times|serif|georgia|garamond|book|cambria|minion/i.test(font)) return `Georgia, 'Times New Roman', serif`;
  if (/courier|mono|consol/i.test(font)) return `'Courier New', monospace`;
  return `Helvetica, Arial, sans-serif`;
};

const TailoredResumeDocument = ({ resume, sourceResumeText, sourceLayout, fileBase }: Props) => {
  const doc = useMemo(
    () => buildFormattedDocument(resume, { layout: sourceLayout, rawText: sourceResumeText }),
    [resume, sourceResumeText, sourceLayout]
  );
  const sections = useMemo(() => sectionsOf(doc), [doc]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  const geo = doc.layout.pages[0] ?? { width: 612, height: 792 };
  // Scale points to the preview column so proportions match the source document.
  const PREVIEW_WIDTH = 560;
  const scale = PREVIEW_WIDTH / geo.width;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => copy(doc.text, "full")}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          {copiedKey === "full" ? <Check size={12} /> : <Copy size={12} />}
          {copiedKey === "full" ? "Copied" : "Copy full resume"}
        </button>
        <button
          onClick={() => downloadTailoredDocx(doc, fileBase).catch(() => toast.error("DOCX export failed"))}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileText size={12} /> DOCX (best fidelity)
        </button>
        <button
          onClick={() => downloadTailoredPdf(doc, fileBase)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileDown size={12} /> PDF
        </button>
      </div>

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sections
            .filter((s) => s.name)
            .map((s, i) => (
              <button
                key={i}
                onClick={() => copy(s.text, `sec${i}`)}
                className={`text-[10.5px] font-medium px-2 py-1 rounded-md transition-all ${
                  copiedKey === `sec${i}`
                    ? "bg-[hsl(var(--success-bg))] text-success"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {copiedKey === `sec${i}` ? "Copied" : `Copy ${s.name.toLowerCase()}`}
              </button>
            ))}
        </div>
      )}

      <div className="space-y-4 overflow-x-auto">
        {doc.pages.map((page, pi) => (
          <div
            key={pi}
            className="rounded-xl border border-border/60 bg-card shadow-sm mx-auto"
            style={{
              width: PREVIEW_WIDTH,
              minHeight: geo.height * scale,
              paddingTop: doc.layout.margins.top * scale,
              paddingBottom: doc.layout.margins.bottom * scale,
              paddingLeft: doc.layout.margins.left * scale,
              paddingRight: doc.layout.margins.right * scale,
            }}
          >
            {page.map((line, li) => {
              const run = line.runs[0] ?? { size: doc.layout.baseSize, bold: false, italic: false, font: doc.layout.baseFont };
              const gap = li === 0 ? 0 : Math.max(0, line.spaceBefore - run.size * 1.15) * scale;
              return (
                <div
                  key={li}
                  className="group/line flex items-start gap-2"
                  style={{ marginTop: gap }}
                >
                  <p
                    className="flex-1 text-foreground whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: cssFamily(run.font),
                      fontSize: run.size * scale * (96 / 72),
                      lineHeight: 1.2,
                      fontWeight: run.bold ? 700 : 400,
                      fontStyle: run.italic ? "italic" : "normal",
                      paddingLeft: line.indent * scale,
                      textAlign: line.align,
                      textIndent: line.bullet ? -(run.size * 0.9 * scale) : 0,
                    }}
                  >
                    {line.runs.length > 1
                      ? line.runs.map((r, ri) => (
                          <span
                            key={ri}
                            style={{
                              fontWeight: r.bold ? 700 : 400,
                              fontStyle: r.italic ? "italic" : "normal",
                              fontSize: r.size * scale * (96 / 72),
                              fontFamily: cssFamily(r.font),
                            }}
                          >
                            {r.text}
                          </span>
                        ))
                      : line.text}
                  </p>
                  <button
                    onClick={() => copy(line.text.trim(), `p${pi}l${li}`)}
                    className="opacity-0 group-hover/line:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                    aria-label="Copy line"
                  >
                    {copiedKey === `p${pi}l${li}` ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        Preview and downloads are generated from the same formatted document model, using your uploaded resume's fonts,
        spacing, headings, alignment and page breaks. Skills coverage, evidence and confidence stay in the analysis panel
        and are never included in the file.
      </p>
    </div>
  );
};

export default TailoredResumeDocument;
