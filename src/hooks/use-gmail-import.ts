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

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function useGmailImport(profileId: string | null) {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ImportedJob[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const autoSyncRan = useRef(false);

  // Load persisted imported jobs from database
  const loadJobs = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("imported_jobs")
      .select("*")
      .eq("profile_id", profileId)
      .order("imported_at", { ascending: false });
    if (data) setJobs(data as ImportedJob[]);

    // Load sync metadata
    const { data: meta } = await supabase
      .from("gmail_sync_metadata")
      .select("last_synced_at")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (meta) setLastSyncedAt(meta.last_synced_at);
  }, [profileId]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const importJobs = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in first");
        return [];
      }

      const providerToken = session.provider_token;
      const refreshToken = session.provider_refresh_token;
      if (!providerToken) {
        toast.error("No Google access. Please sign out and sign in with Google to grant Gmail access.");
        return [];
      }

      const res = await supabase.functions.invoke("fetch-gmail-jobs", {
        body: { providerToken, refreshToken },
      });

      if (res.error) {
        toast.error(res.error.message || "Failed to fetch Gmail jobs");
        return [];
      }

      const data = res.data;
      if (data?.error) {
        toast.error(data.error);
        return [];
      }

      const importedJobs = data?.jobs || [];

      if (importedJobs.length === 0) {
        toast.info("No new job alerts since last sync.");
      } else {
        toast.success(`Found ${importedJobs.length} new jobs from ${data?.emailCount || 0} emails!`);
      }

      // Reload from DB to get full persisted list
      await loadJobs();
      return importedJobs;
    } catch (err: any) {
      toast.error(err.message || "Gmail import failed");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Auto-sync: run silently on load if >6 hours stale
  useEffect(() => {
    if (!profileId || autoSyncRan.current) return;

    const autoSync = async () => {
      const { data: meta } = await supabase
        .from("gmail_sync_metadata")
        .select("last_synced_at")
        .eq("profile_id", profileId)
        .maybeSingle();

      const lastSync = meta?.last_synced_at;
      const isStale =
        !lastSync || new Date(lastSync).getTime() < Date.now() - SIX_HOURS;

      if (!isStale) return;

      // Check if we have a provider token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      autoSyncRan.current = true;
      console.log("Auto-syncing Gmail jobs (stale > 6h)...");

      try {
        await supabase.functions.invoke("fetch-gmail-jobs", {
          body: {
            providerToken: session.provider_token,
            refreshToken: session.provider_refresh_token,
          },
        });
        await loadJobs();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    };

    autoSync();
  }, [profileId, loadJobs]);

  const markSeen = async (jobId: string) => {
    await supabase.from("imported_jobs").update({ seen: true }).eq("id", jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, seen: true } : j));
  };

  const unseenCount = jobs.filter(j => !j.seen).length;

  return { importJobs, loading, jobs, unseenCount, lastSyncedAt, markSeen, loadJobs };
}
