import { useState, useEffect, useCallback } from "react";
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
  imported_at: string;
  seen: boolean;
}

export function useGmailImport(profileId: string | null) {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ImportedJob[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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

  const markSeen = async (jobId: string) => {
    await supabase.from("imported_jobs").update({ seen: true }).eq("id", jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, seen: true } : j));
  };

  const unseenCount = jobs.filter(j => !j.seen).length;

  return { importJobs, loading, jobs, unseenCount, lastSyncedAt, markSeen, loadJobs };
}
