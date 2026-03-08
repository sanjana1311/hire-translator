import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GmailJob {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  snippet: string;
}

export function useGmailImport() {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<GmailJob[]>([]);

  const importJobs = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in first");
        return [];
      }

      const providerToken = session.provider_token;
      if (!providerToken) {
        toast.error("No Google access. Please sign out and sign in with Google to grant Gmail access.");
        return [];
      }

      const res = await supabase.functions.invoke("fetch-gmail-jobs", {
        body: { providerToken },
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
      setJobs(importedJobs);

      if (importedJobs.length === 0) {
        toast.info(data?.message || "No job alerts found in your recent emails.");
      } else {
        toast.success(`Found ${importedJobs.length} jobs from ${data?.emailCount || 0} emails!`);
      }

      return importedJobs;
    } catch (err: any) {
      toast.error(err.message || "Gmail import failed");
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { importJobs, loading, jobs, setJobs };
}
