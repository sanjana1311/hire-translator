import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { SyncReport, EmailReport, SyncCounts, SyncErrorItem } from "@/hooks/use-gmail-import";

type Bucket = "scanned" | "imported" | "applications" | "skipped" | "failed";

const STATUS_LABEL: Record<EmailReport["status"], string> = {
  imported: "Imported",
  application: "Application tracked",
  duplicate: "Duplicate",
  no_jobs: "No roles listed",
  rejected: "Not a job alert",
  parse_failed: "Parse failed",
};

const STATUS_CLASS: Record<EmailReport["status"], string> = {
  imported: "bg-success/10 text-success",
  application: "bg-primary/10 text-primary",
  duplicate: "bg-secondary text-secondary-foreground",
  no_jobs: "bg-secondary text-muted-foreground",
  rejected: "bg-warning/10 text-warning",
  parse_failed: "bg-destructive/10 text-destructive",
};

const BUCKET_LABEL: Record<Bucket, string> = {
  scanned: "All scanned emails",
  imported: "Emails that produced jobs",
  applications: "Roles you applied to",
  skipped: "Skipped — duplicate or irrelevant",
  failed: "Failed to parse",
};

function inBucket(e: EmailReport, bucket: Bucket) {
  if (bucket === "scanned") return true;
  if (bucket === "imported") return e.status === "imported";
  if (bucket === "applications") return e.status === "application";
  if (bucket === "skipped") return e.status === "duplicate" || e.status === "rejected" || e.status === "no_jobs";
  return e.status === "parse_failed";
}


function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
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
  counts,
  errors,
  syncedAt,
  loading,
  error,
  onRetry,
}: {
  report: SyncReport | null;
  counts?: SyncCounts | null;
  errors?: SyncErrorItem[];
  syncedAt?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) => {
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  if (loading) {
    return (
      <div className="mb-5 apple-card px-5 py-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Syncing…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-5 apple-card px-5 py-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">Gmail sync failed</p>
            <p className="text-[12px] text-muted-foreground break-words">{error}</p>
            <div className="flex items-center gap-3 mt-1">
              {onRetry && (
                <button onClick={onRetry} className="text-[12px] text-primary hover:underline">
                  Retry sync
                </button>
              )}
              {(errors?.length ?? 0) > 0 && (
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-[12px] text-muted-foreground hover:underline flex items-center gap-1"
                >
                  {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  View details
                </button>
              )}
            </div>
            {showDetails && (
              <ul className="mt-2 space-y-1">
                {errors?.map((e, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{e.stage} · {e.code}</span> — {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  const resolved: SyncCounts = counts ?? {
    scanned: report?.emailsScanned ?? 0,
    imported: report?.jobsImported ?? 0,
    skipped: report ? report.duplicatesSkipped + report.emailsRejected : 0,
    failed: report?.parseFailures ?? 0,
  };

  if (!report && !counts) return null;

  const rows = bucket ? (report?.emails ?? []).filter((e) => inBucket(e, bucket)) : [];

  return (
    <div className="mb-5 apple-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <CheckCircle2 className="w-4 h-4 text-success mr-1.5" />
        <Num value={resolved.scanned} label="scanned" active={bucket === "scanned"} onClick={() => setBucket(bucket === "scanned" ? null : "scanned")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={resolved.imported} label="imported" active={bucket === "imported"} onClick={() => setBucket(bucket === "imported" ? null : "imported")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={resolved.skipped} label="skipped" active={bucket === "skipped"} onClick={() => setBucket(bucket === "skipped" ? null : "skipped")} />
        <span className="text-muted-foreground/50">·</span>
        <Num value={resolved.failed} label="failed" active={bucket === "failed"} onClick={() => setBucket(bucket === "failed" ? null : "failed")} />
      </div>

      <div className="mt-1 flex items-center gap-3">
        {syncedAt && (
          <p className="text-[11px] text-muted-foreground">Last synced {relativeTime(syncedAt)}</p>
        )}
        {report && (
          <button
            onClick={() => setBucket(bucket ? null : "scanned")}
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            {bucket ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            View details
          </button>
        )}
      </div>

      {(errors?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1">
          {errors!.map((e, i) => (
            <li key={i} className="text-[11px] text-warning">
              {e.message}
            </li>
          ))}
        </ul>
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
