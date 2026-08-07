import { useMemo, useState } from "react";
import { Copy, Check, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import type { TailoredResume } from "@/lib/resume-guard";
import { renderTailoredDocument } from "@/lib/resume-template";
import { downloadTailoredPdf, downloadTailoredDocx } from "@/lib/resume-export";

interface Props {
  resume: TailoredResume;
  sourceResumeText: string;
  fileBase: string;
}

const IconBtn = ({ onClick, label, active }: { onClick: () => void; label: string; active?: boolean }) => (
  <button
    onClick={onClick}
    className={`text-[10.5px] font-medium px-2 py-1 rounded-md transition-all ${
      active ? "bg-[hsl(var(--success-bg))] text-success" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    }`}
  >
    {label}
  </button>
);

const TailoredResumeDocument = ({ resume, sourceResumeText, fileBase }: Props) => {
  const doc = useMemo(() => renderTailoredDocument(resume, sourceResumeText), [resume, sourceResumeText]);
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
          onClick={() => downloadTailoredPdf(doc, fileBase)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileDown size={12} /> PDF
        </button>
        <button
          onClick={() => downloadTailoredDocx(doc, fileBase).catch(() => toast.error("DOCX export failed"))}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <FileText size={12} /> DOCX
        </button>
      </div>

      <div className="rounded-xl border border-border/60 p-4 bg-card">
        {doc.header.length > 0 && (
          <div className="mb-3 pb-3 border-b border-border/50">
            {doc.header.map((l, i) => (
              <p key={i} className={i === 0 ? "text-[13px] font-semibold text-foreground" : "text-[11px] text-muted-foreground"}>
                {l}
              </p>
            ))}
          </div>
        )}

        {doc.sections.map((s, si) => (
          <section key={si} className="mb-4 last:mb-0 group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              {s.name ? (
                <p className="text-[11.5px] font-semibold tracking-wide text-foreground">{s.name}</p>
              ) : (
                <span />
              )}
              <IconBtn
                onClick={() => copy(s.text, `s${si}`)}
                label={copiedKey === `s${si}` ? "Copied" : "Copy section"}
                active={copiedKey === `s${si}`}
              />
            </div>
            <div className="space-y-0.5">
              {s.lines.map((l, li) =>
                l.trim() ? (
                  <div key={li} className="flex items-start gap-2 group/line">
                    <p className="text-[11.5px] leading-[1.75] text-secondary-foreground whitespace-pre-wrap flex-1">{l}</p>
                    <button
                      onClick={() => copy(l.trim(), `s${si}l${li}`)}
                      className="opacity-0 group-hover/line:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                      aria-label="Copy line"
                    >
                      {copiedKey === `s${si}l${li}` ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <div key={li} className="h-1.5" />
                )
              )}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[10.5px] text-muted-foreground">
        Export keeps your uploaded resume's sections, order and layout. Analysis (skills coverage, evidence, confidence)
        stays in the analysis panel and is never included in the download.
      </p>
    </div>
  );
};

export default TailoredResumeDocument;
