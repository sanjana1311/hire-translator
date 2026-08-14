import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { SyncReport, EmailReport } from "@/hooks/use-gmail-import";

type Bucket = "scanned" | "imported" | "skipped" | "failed";

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

const BUCKET_LABEL: Record<Bucket, string> = {
  scanned: "All scanned emails",
  imported: "Emails that produced jobs",
  skipped: "Skipped — duplicate or irrelevant",
  failed: "Failed to parse",
};

function inBucket(e: EmailReport, bucket: Bucket) {
  if (bucket === "scanned") return true;
  if (bucket === "imported") return e.status === "imported";
  if (bucket === "skipped") return e.status === "duplicate" || e.status === "rejected" || e.status === "no_jobs";
  return e.status === "parse_failed";
}

function Num({
  value,
  label,
  active,
  onClick,
}: {
  value: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md transition-colors ${
        active ? "bg-secondary text-foreground" : "hover:bg-secondary/60 text-muted-foreground"
      }`}
    >
      <span className="font-semibold tabular-nums text-foreground">{value}</span>{" "}
      <span className="text-[13px]">{label}</span>
    </button>
  );
}

export const GmailSyncSummary = ({
  report,
  syncedAt,
  loading,
  error,
  onRetry,
}: {
  report: SyncReport | null;
  syncedAt?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) => {
  const [bucket, setBucket] = useState<Bucket | null>(null);

  if (loading) {
    return (
      <div className="mb-5 apple-card px-5 py-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Syncing your inbox…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-5 apple-card px-5 py-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-foreground">Gmail sync failed</p>
          <p className="text-[12px] text-muted-foreground break-words">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-1 text-[12px] text-primary hover:underline">
              Retry sync
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!report) return null;

  const skipped = report.duplicatesSkipped + report.emailsRejected;
  const failed = report.parseFailures;
  const rows = bucket ? report.emails.filter((e) => inBucket(e, bucket)) : [];

  return (
    <div className="mb-5 apple-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <CheckCircle2 className="w-4 h-4 text-success mr-1.5" />
        <Num value={report.emailsScanned} label="scanned" active={bucket === "scanned"} onClick={() => setBucket(bucket === "scanned" ? null : "scanned")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={report.jobsImported} label="jobs imported" active={bucket === "imported"} onClick={() => setBucket(bucket === "imported" ? null : "imported")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={skipped} label="skipped" active={bucket === "skipped"} onClick={() => setBucket(bucket === "skipped" ? null : "skipped")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={failed} label="failed" active={bucket === "failed"} onClick={() => setBucket(bucket === "failed" ? null : "failed")} />
      </div>

      {syncedAt && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Last sync {new Date(syncedAt).toLocaleString()}
        </p>
      )}

      {bucket && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground mb-1">
            {BUCKET_LABEL[bucket]} ({rows.length})
          </p>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing in this group.</p>
          ) : (
            <div className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
              {rows.map((e, i) => (
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
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">Reason: {e.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GmailSyncSummary;
