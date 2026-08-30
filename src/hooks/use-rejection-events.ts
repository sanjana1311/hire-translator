import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RejectionEvent {
  id: string;
  profile_id: string;
  application_id: string | null;
  imported_job_id: string | null;
  gmail_message_id: string;
  company: string;
  role_title: string;
  received_at: string;
  evidence_snippet: string;
  email_subject: string;
  sender: string;
  confidence: number;
  match_status: string;
  explicit_reason: string | null;
  created_at: string;
}

export type RejectionSyncState = "idle" | "syncing" | "success" | "error" | "not_connected" | "token_expired";

export function useRejectionEvents(profileId: string | null) {
  const [events, setEvents] = useState<RejectionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<RejectionSyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastScanCount, setLastScanCount] = useState<number | null>(null);

  // Shared connection/sync state — same source as Roles and Applications.
  const gmail = useGmailConnection(profileId);
  const gmailConnected = gmail.connected;
  const lastSyncedAt = gmail.lastRejectionSyncAt;

  const load = useCallback(async () => {
    if (!profileId) return;
    const { data: evts } = await supabase
      .from("rejection_events")
      .select("*")
      .eq("profile_id", profileId)
      .order("received_at", { ascending: false });
    setEvents((evts ?? []) as RejectionEvent[]);
    await gmail.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, gmail.refresh]);

  useEffect(() => {
    load();
  }, [load]);


  const sync = useCallback(
    async (days = 30) => {
      if (!profileId) return;
      setLoading(true);
      setSyncState("syncing");
      setSyncError(null);
      try {
        const { data, error } = await supabase.functions.invoke("sync-rejection-emails", { body: { days } });
        if (error) throw new Error(error.message);
        if (data?.notConnected) {
          setSyncState("not_connected");
          setGmailConnected(false);
          return;
        }
        if (data?.tokenExpired) {
          setSyncState("token_expired");
          setSyncError(data.error);
          return;
        }
        if (data?.error) throw new Error(data.error);

        await load();
        setSyncState("success");
        setLastScanCount(data?.emailCount ?? 0);
        const found = data?.events?.length ?? 0;
        toast.success(
          found === 0
            ? `Scanned ${data?.emailCount ?? 0} emails — no new rejections found.`
            : `${found} rejection email${found === 1 ? "" : "s"} synced (${data?.needsReview ?? 0} need review).`,
        );
      } catch (err: any) {
        setSyncState("error");
        setSyncError(err.message || "Gmail sync failed");
        toast.error(err.message || "Gmail sync failed");
      } finally {
        setLoading(false);
      }
    },
    [profileId, load],
  );

  const confirmMatch = useCallback(
    async (eventId: string, applicationId: string | null) => {
      const evt = events.find((e) => e.id === eventId);
      const { error } = await supabase
        .from("rejection_events")
        .update({ application_id: applicationId, match_status: applicationId ? "matched" : "unmatched", confidence: 1 })
        .eq("id", eventId);
      if (error) return toast.error(error.message);
      if (applicationId) {
        await supabase
          .from("applications")
          .update({ status: "rejected", last_email_date: evt?.received_at?.slice(0, 10) })
          .eq("id", applicationId);
      }
      await load();
      toast.success(applicationId ? "Match confirmed — application marked Rejected." : "Email dismissed.");
    },
    [events, load],
  );

  const dismissEvent = useCallback(
    async (eventId: string) => {
      const { error } = await supabase.from("rejection_events").update({ match_status: "dismissed" }).eq("id", eventId);
      if (error) return toast.error(error.message);
      await load();
      toast.success("Email dismissed — it won't appear in analysis.");
    },
    [load],
  );

  const deleteAllSyncedEmails = useCallback(async () => {
    if (!profileId) return;
    const { error } = await supabase.from("rejection_events").delete().eq("profile_id", profileId);
    if (error) return toast.error(error.message);
    await load();
    toast.success("All synced rejection email data deleted.");
  }, [profileId, load]);

  const disconnectGmail = useCallback(async () => {
    if (!profileId) return;
    const { error } = await supabase
      .from("gmail_sync_metadata")
      .update({ refresh_token: null, enabled: false })
      .eq("profile_id", profileId);
    if (error) return toast.error(error.message);
    await supabase.from("rejection_events").delete().eq("profile_id", profileId);
    await load();
    setGmailConnected(false);
    toast.success("Gmail disconnected and synced email data deleted.");
  }, [profileId, load]);

  return {
    events,
    loading,
    syncState,
    syncError,
    lastSyncedAt,
    gmailConnected,
    lastScanCount,
    sync,
    reload: load,
    confirmMatch,
    dismissEvent,
    deleteAllSyncedEmails,
    disconnectGmail,
  };
}
