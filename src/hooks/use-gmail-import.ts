import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImportedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  snippet: string;
  salary: string | null;
  description: string | null;
  url_verified: boolean;
  description_fetched_at: string | null;
  source_email_subject: string | null;
  status: string;
  imported_at: string;
  seen: boolean;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "no_token" | "never_synced";

export interface SyncLogEntry {
  time: string;
  message: string;
}

export interface EmailReport {
  subject: string;
  from: string;
  source: string;
  status: "imported" | "duplicate" | "no_jobs" | "rejected" | "parse_failed";
  reason: string | null;
  method: "ai" | "fallback" | "none";
  jobsFound: number;
  jobsImported: number;
  duplicates: number;
}

export interface SyncReport {
  emailsScanned: number;
  jobAlertsDetected: number;
  jobsImported: number;
  duplicatesSkipped: number;
  emailsRejected: number;
  parseFailures: number;
  applicationsMatched: number;
  query: string;
  emails: EmailReport[];
}

export interface SyncErrorItem {
  stage: string;
  code: string;
  message: string;
}

export interface SyncCounts {
  scanned: number;
  imported: number;
  skipped: number;
  failed: number;
}

export interface SyncResult extends SyncCounts {
  success: boolean;
  requestId: string;
  syncStartedAt: string;
  syncCompletedAt: string;
  errors: SyncErrorItem[];
  report: SyncReport | null;
  jobs: any[];
  notConnected?: boolean;
  tokenExpired?: boolean;
  error?: string;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function countsFromReport(report: SyncReport | null): SyncCounts {
  if (!report) return { scanned: 0, imported: 0, skipped: 0, failed: 0 };
  return {
    scanned: report.emailsScanned,
    imported: report.jobsImported,
    skipped: report.duplicatesSkipped + report.emailsRejected,
    failed: report.parseFailures,
  };
}

export function friendlyErrorMessage(result: Partial<SyncResult> | null): string | null {
  if (!result) return null;
  if (result.success) return null;
  const first = result.errors?.[0];
  if (first) return first.message;
  if (result.error) return String(result.error);
  return "Gmail sync failed. Please retry.";
}

export function useGmailImport(profileId: string | null) {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ImportedJob[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [jobsImportedCount, setJobsImportedCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncReportAt, setSyncReportAt] = useState<string | null>(null);
  const [syncCounts, setSyncCounts] = useState<SyncCounts | null>(null);
  const [syncErrors, setSyncErrors] = useState<SyncErrorItem[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSyncRan = useRef(false);

  const log = useCallback((message: string) => {
    setSyncLog(prev => [...prev, { time: timestamp(), message }]);
  }, []);

  /** Apply a completed sync result — only after the request fully finished */
  const applyResult = useCallback((result: SyncResult) => {
    setSyncReport(result.report ?? null);
    setSyncCounts({
      scanned: result.scanned ?? 0,
      imported: result.imported ?? 0,
      skipped: result.skipped ?? 0,
      failed: result.failed ?? 0,
    });
    setSyncReportAt(result.syncCompletedAt ?? new Date().toISOString());
    setSyncErrors(result.errors ?? []);
    setSyncError(friendlyErrorMessage(result));
    log(
      `[${result.requestId?.slice(0, 8) ?? "sync"}] ${result.success ? "success" : "failed"} · scanned ${result.scanned} · imported ${result.imported} · skipped ${result.skipped} · failed ${result.failed}`
    );
    for (const e of result.errors ?? []) {
      log(`✗ ${e.stage}/${e.code}: ${e.message}`);
    }
  }, [log]);

  // Load persisted jobs + the last sync summary stored server-side
  const loadJobs = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("imported_jobs")
      .select("*")
      .eq("profile_id", profileId)
      .order("imported_at", { ascending: false });
    if (data) {
      setJobs(data as ImportedJob[]);
      setJobsImportedCount(data.length);
    }

    const { data: meta } = await supabase
      .from("gmail_sync_metadata")
      .select("last_synced_at, last_sync_status, last_sync_summary, last_sync_completed_at, last_sync_error")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (meta?.last_synced_at) {
      setLastSyncedAt(meta.last_synced_at);
      setSyncStatus("success");
    } else {
      setSyncStatus("never_synced");
    }

    const summary = meta?.last_sync_summary as any;
    if (summary) {
      setSyncReport(summary.report ?? null);
      setSyncCounts({
        scanned: summary.scanned ?? 0,
        imported: summary.imported ?? 0,
        skipped: summary.skipped ?? 0,
        failed: summary.failed ?? 0,
      });
      setSyncErrors(summary.errors ?? []);
      setSyncReportAt(meta?.last_sync_completed_at ?? null);
    }

    // Preserve a server-side failure even when an older deployment did not
    // persist a full summary. This keeps the dashboard actionable after a
    // function crash instead of silently showing stale job data.
    if (meta?.last_sync_status === "error") {
      setSyncError(meta.last_sync_error ?? "Gmail sync failed. Please retry.");
      setSyncStatus("error");
    } else if (meta?.last_sync_status === "success") {
      setSyncError(null);
    }
  }, [profileId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const triggerSync = useCallback(async (silent = false) => {
    if (!profileId) return [];
    setLoading(true);
    setSyncStatus("syncing");
    setSyncError(null);
    log("Sync started");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        log("No app session");
        setSyncStatus("no_token");
        setSyncError("You are signed out. Please sign in again.");
        if (!silent) toast.error("Please sign in first");
        return [];
      }

      const res = await supabase.functions.invoke("fetch-gmail-jobs", {
        body: {
          providerToken: session.provider_token ?? null,
          refreshToken: session.provider_refresh_token ?? null,
        },
      });

      if (res.error) {
        // Transport-level failure (function crashed / unreachable)
        let message = res.error.message || "Gmail sync failed";
        try {
          const body = await (res.error as any)?.context?.json?.();
          message = friendlyErrorMessage(body) ?? message;
        } catch { /* body not readable */ }
        log(`Transport error: ${message}`);
        setSyncErrors([{ stage: "network", code: "FUNCTION_UNREACHABLE", message }]);
        setSyncError(message);
        setSyncStatus("error");
        if (!silent) toast.error(message);
        return [];
      }

      const result = res.data as SyncResult;
      applyResult(result);

      if (result?.notConnected) {
        setSyncStatus("never_synced");
        if (!silent) toast.error("Connect your Gmail account to import job alerts.");
        return [];
      }

      if (!result?.success) {
        setSyncStatus(result?.tokenExpired ? "no_token" : "error");
        if (!silent) toast.error(friendlyErrorMessage(result) ?? "Gmail sync failed");
        return [];
      }

      await loadJobs();
      setLastSyncedAt(result.syncCompletedAt);
      setSyncStatus("success");
      // Re-apply — loadJobs() rehydrates from the DB and must not clobber counts
      applyResult(result);

      if (!silent) {
        if (result.imported === 0) {
          toast.info(`Scanned ${result.scanned} emails · ${result.skipped} skipped · ${result.failed} failed`);
        } else {
          toast.success(`Imported ${result.imported} new jobs from ${result.scanned} emails`);
        }
      }

      return result.jobs ?? [];
    } catch (err: any) {
      const message = err?.message || "Gmail import failed";
      log(`Sync failed: ${message}`);
      setSyncErrors([{ stage: "client", code: "CLIENT_EXCEPTION", message }]);
      setSyncError(message);
      setSyncStatus("error");
      if (!silent) toast.error(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [profileId, loadJobs, log, applyResult]);

  // Connect Gmail — direct OAuth flow bypassing Supabase auth provider
  const connectGmail = useCallback(async () => {
    log("Initiating Gmail OAuth flow");
    try {
      const clientId = "704063554549-857m65opcgpm2nkfhulmjqbvncgkrj25.apps.googleusercontent.com";
      const origin = window.location.origin;
      let redirectOrigin = origin;
      const iframeMatch = origin.match(/^https:\/\/([a-f0-9-]+)\.lovableproject\.com$/);
      if (iframeMatch) {
        redirectOrigin = `https://id-preview--${iframeMatch[1]}.lovable.app`;
      }
      const redirectUri = redirectOrigin + "/gmail-callback";
      const scope = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly";

      const state = crypto.randomUUID();
      sessionStorage.setItem("gmail_oauth_state", state);

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("state", state);

      window.location.href = authUrl.toString();
    } catch (err: any) {
      log(`OAuth error: ${err.message}`);
      toast.error(err.message || "Google sign-in failed");
    }
  }, [log]);

  // Handle OAuth callback — exchange code for tokens
  const handleOAuthCallback = useCallback(async (code: string) => {
    if (!profileId) return;
    setLoading(true);
    setSyncStatus("syncing");
    log("Exchanging OAuth code for Gmail tokens");

    try {
      const origin = window.location.origin;
      let redirectOrigin = origin;
      const iframeMatch = origin.match(/^https:\/\/([a-f0-9-]+)\.lovableproject\.com$/);
      if (iframeMatch) {
        redirectOrigin = `https://id-preview--${iframeMatch[1]}.lovable.app`;
      }
      const redirectUri = redirectOrigin + "/gmail-callback";
      const res = await supabase.functions.invoke("gmail-oauth-exchange", {
        body: { code, redirectUri },
      });

      if (res.error || res.data?.error) {
        const message = res.error?.message || res.data?.error || "Failed to connect Gmail";
        log(`Token exchange error: ${message}`);
        setSyncError(message);
        toast.error(message);
        setSyncStatus("error");
        return;
      }

      log("Gmail connected — starting first sync");
      toast.success("Gmail connected! Syncing your job alerts...");
      await triggerSync(false);
    } catch (err: any) {
      log(`OAuth callback error: ${err.message}`);
      setSyncError(err?.message || "Failed to connect Gmail");
      toast.error("Failed to connect Gmail");
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }, [profileId, log, triggerSync]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  // Capture refresh token immediately after OAuth redirect and trigger first sync
  useEffect(() => {
    if (!profileId) return;

    const captureTokenAndSync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_refresh_token) return;

      const { error: upsertErr } = await supabase
        .from("gmail_sync_metadata")
        .upsert(
          { profile_id: profileId, refresh_token: session.provider_refresh_token },
          { onConflict: "profile_id" }
        );

      if (upsertErr) log(`Could not store Google refresh token: ${upsertErr.message}`);

      if (session.provider_token && !autoSyncRan.current) {
        autoSyncRan.current = true;
        await triggerSync(false);
      }
    };

    captureTokenAndSync();
  }, [profileId, log, triggerSync]);

  // Auto-sync: run silently on load if >6 hours stale AND Gmail is connected
  useEffect(() => {
    if (!profileId || autoSyncRan.current) return;

    const autoSync = async () => {
      const { data: meta } = await supabase
        .from("gmail_sync_metadata")
        .select("last_synced_at, enabled")
        .eq("profile_id", profileId)
        .maybeSingle();

      if (!meta || !meta.enabled) return;

      const lastSync = meta?.last_synced_at;
      const isStale = !lastSync || new Date(lastSync).getTime() < Date.now() - SIX_HOURS;
      if (!isStale) return;

      autoSyncRan.current = true;
      await triggerSync(true);
    };

    const timer = setTimeout(autoSync, 1000);
    return () => clearTimeout(timer);
  }, [profileId, triggerSync]);

  const markSeen = async (jobId: string) => {
    await supabase.from("imported_jobs").update({ seen: true }).eq("id", jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, seen: true } : j));
  };

  const unseenCount = jobs.filter(j => !j.seen).length;

  return {
    triggerSync,
    connectGmail,
    handleOAuthCallback,
    signOut,
    loading,
    jobs,
    unseenCount,
    lastSyncedAt,
    jobsImportedCount,
    syncStatus,
    syncLog,
    syncReport,
    syncReportAt,
    syncCounts,
    syncErrors,
    syncError,
    markSeen,
    loadJobs,
  };
}
