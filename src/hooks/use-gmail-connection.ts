import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for Gmail connection + sync state.
 *
 * Roles, Applications and Rejection Analysis previously each read
 * `gmail_sync_metadata` with a different column set, so one page could show
 * "synced 2 minutes ago" while another showed "Connect Gmail / never".
 * Every surface must read this shape instead.
 */
export interface GmailConnectionState {
  /** A refresh token is stored and the integration is enabled. */
  connected: boolean;
  enabled: boolean;
  /** Last successful job-alert sync (the canonical "last Gmail sync"). */
  lastSyncedAt: string | null;
  /** Last rejection-specific scan; falls back to the canonical sync. */
  lastRejectionSyncAt: string | null;
  lastSyncStatus: string | null;
  /** True until the first read resolves — never render "never synced" while loading. */
  loading: boolean;
  /** Non-null when the metadata read itself failed (do not treat as disconnected). */
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY = {
  connected: false,
  enabled: false,
  lastSyncedAt: null as string | null,
  lastRejectionSyncAt: null as string | null,
  lastSyncStatus: null as string | null,
};

export function useGmailConnection(profileId?: string | null): GmailConnectionState {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) {
      // No profile resolved yet — stay in the loading state rather than
      // reporting "disconnected", which is what caused the cross-tab mismatch.
      setLoading(true);
      return;
    }
    const { data, error: err } = await supabase
      .from("gmail_sync_metadata")
      .select("refresh_token, enabled, last_synced_at, last_rejection_sync_at, last_sync_status")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setError(null);
    setState({
      connected: Boolean((data as any)?.refresh_token && (data as any)?.enabled),
      enabled: Boolean((data as any)?.enabled),
      lastSyncedAt: (data as any)?.last_synced_at ?? null,
      lastRejectionSyncAt: (data as any)?.last_rejection_sync_at ?? (data as any)?.last_synced_at ?? null,
      lastSyncStatus: (data as any)?.last_sync_status ?? null,
    });
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, loading, error, refresh };
}
