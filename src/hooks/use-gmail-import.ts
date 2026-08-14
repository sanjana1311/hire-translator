import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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

const SIX_HOURS = 6 * 60 * 60 * 1000;

const reportKey = (profileId: string) => `gmail_sync_report_${profileId}`;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSyncRan = useRef(false);

  // Restore the last persisted sync summary for this user
  useEffect(() => {
    if (!profileId) return;
    try {
      const raw = localStorage.getItem(reportKey(profileId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { report: SyncReport; at: string };
      if (parsed?.report) {
        setSyncReport(parsed.report);
        setSyncReportAt(parsed.at ?? null);
      }
    } catch {
      /* ignore corrupt cache */
    }
  }, [profileId]);

  const log = useCallback((message: string) => {
    setSyncLog(prev => [...prev, { time: timestamp(), message }]);
  }, []);

  const applyReport = useCallback((report: SyncReport | null | undefined) => {
    if (!report) return;
    const at = new Date().toISOString();
    setSyncReport(report);
    setSyncReportAt(at);
    setSyncError(null);
    if (profileId) {
      try {
        localStorage.setItem(reportKey(profileId), JSON.stringify({ report, at }));
      } catch {
        /* storage full — non-fatal */
      }
    }
    log(
      `Scanned ${report.emailsScanned} emails · ${report.jobAlertsDetected} job alerts · ${report.jobsImported} imported · ${report.duplicatesSkipped} duplicates · ${report.emailsRejected} rejected · ${report.parseFailures} parse failures · ${report.applicationsMatched} applications matched`
    );
    for (const e of report.emails) {
      if (e.status === "rejected" || e.status === "parse_failed") {
        log(`✗ ${e.status}: "${e.subject.slice(0, 60)}" — ${e.reason ?? "no reason given"}`);
      }
    }
  }, [log, profileId]);



  // Load persisted imported jobs from database
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

    // Load sync metadata
    const { data: meta } = await supabase
      .from("gmail_sync_metadata")
      .select("last_synced_at")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (meta?.last_synced_at) {
      setLastSyncedAt(meta.last_synced_at);
      setSyncStatus("success");
    } else {
      setSyncStatus("never_synced");
    }
  }, [profileId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const triggerSync = useCallback(async (silent = false) => {
    if (!profileId) return [];
    setLoading(true);
    setSyncStatus("syncing");
    log("Sync triggered");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        log("No session found");
        setSyncStatus("no_token");
        if (!silent) toast.error("Please sign in first");
        return [];
      }

      const providerToken = session.provider_token;
      const refreshToken = session.provider_refresh_token;
      log(`Google token: ${providerToken ? "present" : "missing"}`);

      if (!providerToken) {
        // Let the edge function handle refresh token lookup server-side
        log("No provider token in session — delegating to edge function with stored token");
        const res = await supabase.functions.invoke("fetch-gmail-jobs", {
          body: { useRefreshToken: true },
        });

        if (res.error) {
          log(`Edge function error: ${res.error.message}`);
          setSyncStatus("error");
          if (!silent) toast.error(res.error.message || "Sync failed");
          return [];
        }

        const data = res.data;
        
        // Gmail not connected — not an error, just needs setup
        if (data?.notConnected) {
          log("Gmail not connected — user needs to connect");
          setSyncStatus("never_synced");
          return [];
        }
        
        if (data?.tokenExpired) {
          log("Google token expired — user needs to reconnect");
          setSyncStatus("no_token");
          if (!silent) toast.error("Your Google connection has expired. Please re-connect Gmail.");
          return [];
        }
        
        if (data?.error) {
          log(`Sync error: ${data.error}`);
          setSyncStatus("error");
          if (!silent) toast.error(data.error);
          return [];
        }

        const importedJobs = data?.jobs || [];
        applyReport(data?.report);
        log(`Sync complete: ${importedJobs.length} new jobs from ${data?.emailCount || 0} emails`);

        if (!silent) {
          const r = data?.report;
          if (importedJobs.length === 0) {
            toast.info(
              r
                ? `Scanned ${r.emailsScanned} emails · ${r.duplicatesSkipped} duplicates · ${r.emailsRejected} not job alerts`
                : "No new job alerts since last sync."
            );
          } else {
            toast.success(`Imported ${importedJobs.length} new jobs from ${r?.jobAlertsDetected ?? 0} job alerts`);
          }
        }


        await loadJobs();
        setSyncStatus("success");
        return importedJobs;
      }

      // We have a provider token — use it directly
      log("Gmail query sent");
      const res = await supabase.functions.invoke("fetch-gmail-jobs", {
        body: { providerToken, refreshToken },
      });

      if (res.error) {
        log(`Edge function error: ${res.error.message}`);
        setSyncStatus("error");
        if (!silent) toast.error(res.error.message || "Failed to fetch Gmail jobs");
        return [];
      }

      const data = res.data;
      if (data?.error) {
        log(`Sync error: ${data.error}`);
        setSyncStatus("error");
        if (!silent) toast.error(data.error);
        return [];
      }

      const importedJobs = data?.jobs || [];
      applyReport(data?.report);
      log(`Sync complete: ${importedJobs.length} new jobs from ${data?.emailCount || 0} emails`);

      if (!silent) {
        const r = data?.report;
        if (importedJobs.length === 0) {
          toast.info(
            r
              ? `Scanned ${r.emailsScanned} emails · ${r.duplicatesSkipped} duplicates · ${r.emailsRejected} not job alerts`
              : "No new job alerts since last sync."
          );
        } else {
          toast.success(`Imported ${importedJobs.length} new jobs from ${r?.jobAlertsDetected ?? 0} job alerts`);
        }
      }


      await loadJobs();
      setSyncStatus("success");
      return importedJobs;
    } catch (err: any) {
      log(`Sync failed: ${err.message}`);
      setSyncStatus("error");
      if (!silent) toast.error(err.message || "Gmail import failed");
      return [];
    } finally {
      setLoading(false);
    }
  }, [profileId, loadJobs, log, applyReport]);

  // Connect Gmail — direct OAuth flow bypassing Supabase auth provider
  const connectGmail = useCallback(async () => {
    log("Initiating direct Gmail OAuth flow");
    try {
      const clientId = "704063554549-857m65opcgpm2nkfhulmjqbvncgkrj25.apps.googleusercontent.com";
      // The preview iframe origin (lovableproject.com) differs from the user-facing URL (lovable.app)
      // Use the published domain when available, otherwise construct the correct preview URL
      const origin = window.location.origin;
      let redirectOrigin = origin;
      // Detect lovableproject.com iframe and map to the id-preview lovable.app domain
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
      
      const finalUrl = authUrl.toString();
      console.log("[Gmail OAuth] Full auth URL:", finalUrl);
      console.log("[Gmail OAuth] client_id:", clientId);
      console.log("[Gmail OAuth] redirect_uri:", redirectUri);
      console.log("[Gmail OAuth] scope:", scope);
      window.location.href = finalUrl;
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
      
      if (res.error) {
        log(`Token exchange error: ${res.error.message}`);
        toast.error("Failed to connect Gmail");
        setSyncStatus("error");
        return;
      }
      
      if (res.data?.error) {
        log(`Token exchange error: ${res.data.error}`);
        toast.error(res.data.error);
        setSyncStatus("error");
        return;
      }
      
      log("Gmail connected successfully! Starting first sync...");
      toast.success("Gmail connected! Syncing your job alerts...");
      
      // Trigger sync now
      await triggerSync(false);
    } catch (err: any) {
      log(`OAuth callback error: ${err.message}`);
      toast.error("Failed to connect Gmail");
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }, [profileId, log, triggerSync]);

  // Sign out helper for no_token state
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }, []);

  // Capture refresh token immediately after OAuth redirect and trigger first sync
  useEffect(() => {
    if (!profileId) return;

    const captureTokenAndSync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log("[Gmail Auth Debug] Session exists:", !!session);
      console.log("[Gmail Auth Debug] provider_token:", session?.provider_token ? "present" : "missing");
      console.log("[Gmail Auth Debug] provider_refresh_token:", session?.provider_refresh_token ? "present" : "missing");
      
      if (!session?.provider_refresh_token) {
        log("No provider_refresh_token in session — skipping capture");
        return;
      }

      // Store the refresh token right away so we never lose it
      const tokenPreview = session.provider_refresh_token.slice(0, 10) + "...";
      log(`Capturing Google refresh token from session (${tokenPreview})`);
      
      const { error: upsertErr } = await supabase
        .from("gmail_sync_metadata")
        .upsert(
          { profile_id: profileId, refresh_token: session.provider_refresh_token },
          { onConflict: "profile_id" }
        );
      
      if (upsertErr) {
        log(`ERROR saving refresh token: ${upsertErr.message}`);
        console.error("[Gmail Auth Debug] Upsert error:", upsertErr);
      } else {
        log("Refresh token stored successfully");
        console.log("[Gmail Auth Debug] Refresh token saved to gmail_sync_metadata");
      }

      // If we also have a provider_token, trigger sync immediately
      if (session.provider_token && !autoSyncRan.current) {
        autoSyncRan.current = true;
        log("Fresh provider token available — triggering immediate sync");
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

      // Skip auto-sync if no metadata exists (never connected) or disabled
      if (!meta || !meta.enabled) return;

      const lastSync = meta?.last_synced_at;
      const isStale = !lastSync || new Date(lastSync).getTime() < Date.now() - SIX_HOURS;
      if (!isStale) return;

      autoSyncRan.current = true;
      console.log("Auto-syncing Gmail jobs (stale > 6h)...");
      await triggerSync(true);
    };

    // Small delay to let the token capture effect run first
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

    markSeen,
    loadJobs,
  };
}
