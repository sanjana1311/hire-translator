import { useState } from "react";
import type { SyncReport, EmailReport } from "@/hooks/use-gmail-import";

const STATUS_LABEL: Record<EmailReport["status"], string> = {
  imported: "Imported",
  duplicate: "Duplicate",
  no_jobs: "No roles listed",
  rejected: "Not a job alert",
  parse_failed: "Parse failed",
};

const STATUS_CLASS: Record<EmailReport["status"], string> = {
  imported: "bg-success/10 text-success",
  duplicate: "bg-secondary text-secondary-foreground",
  no_jobs: "bg-secondary text-muted-foreground",
  rejected: "bg-warning/10 text-warning",
  parse_failed: "bg-destructive/10 text-destructive",
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export const GmailSyncSummary = ({ report }: { report: SyncReport }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 apple-card px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <Stat label="Emails scanned" value={report.emailsScanned} />
        <Stat label="Job alerts detected" value={report.jobAlertsDetected} />
        <Stat label="Jobs imported" value={report.jobsImported} />
        <Stat label="Duplicates skipped" value={report.duplicatesSkipped} />
        <Stat label="Emails rejected" value={report.emailsRejected} />
        <Stat label="Parse failures" value={report.parseFailures} />
        <Stat label="Applications matched" value={report.applicationsMatched} />
      </div>

      {report.emails.length > 0 && (
        <>
          <button
            onClick={() => setOpen(!open)}
            className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? "▾ Hide" : "▸ Show"} per-email breakdown ({report.emails.length})
          </button>

          {open && (
            <div className="mt-2 divide-y divide-border/60 max-h-[320px] overflow-y-auto">
              {report.emails.map((e, i) => (
                <div key={i} className="py-2 flex items-start gap-3">
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASS[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs truncate">{e.subject || "(no subject)"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.source}
                      {e.method !== "none" && ` · parsed by ${e.method === "ai" ? "AI" : "pattern parser"}`}
                      {` · ${e.jobsFound} found, ${e.jobsImported} imported, ${e.duplicates} duplicate`}
                    </p>
                    {e.reason && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">{e.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GmailSyncSummary;
