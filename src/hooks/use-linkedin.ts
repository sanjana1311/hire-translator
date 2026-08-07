import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedInAccount {
  member_name: string | null;
  headline: string | null;
  profile_url: string | null;
  connected_at: string | null;
  scopes: string | null;
}

export interface LinkedInStatus {
  configured: boolean;
  connected: boolean;
  account: LinkedInAccount | null;
}

interface FnResult {
  ok?: boolean;
  code?: string;
  message?: string;
  requestId?: string;
  [k: string]: unknown;
}

async function callLinkedIn(body: Record<string, unknown>): Promise<FnResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in and try again.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-oauth`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: FnResult = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!res.ok || parsed.ok === false) {
    const err = new Error(parsed.message || `LinkedIn request failed (${res.status}).`);
    (err as Error & { code?: string }).code = parsed.code;
    throw err;
  }
  return parsed;
}

export const LINKEDIN_REDIRECT_PATH = "/linkedin-callback";

export function useLinkedIn() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await callLinkedIn({ action: "status" });
      setStatus({
        configured: Boolean(r.configured),
        connected: Boolean(r.connected),
        account: (r.account as LinkedInAccount) ?? null,
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      setError({ message: err.message, code: err.code });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const redirectUri = `${window.location.origin}${LINKEDIN_REDIRECT_PATH}`;
      const r = await callLinkedIn({ action: "authorize", redirectUri });
      sessionStorage.setItem("linkedin_oauth_state", String(r.state ?? ""));
      window.location.href = String(r.authorizationUrl);
    } catch (e) {
      const err = e as Error & { code?: string };
      setError({ message: err.message, code: err.code });
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await callLinkedIn({ action: "disconnect" });
      await refresh();
      return true;
    } catch (e) {
      const err = e as Error & { code?: string };
      setError({ message: err.message, code: err.code });
      return false;
    }
  }, [refresh]);

  return { status, loading, error, refresh, connect, disconnect };
}

export async function exchangeLinkedInCode(code: string) {
  const redirectUri = `${window.location.origin}${LINKEDIN_REDIRECT_PATH}`;
  return callLinkedIn({ action: "exchange", code, redirectUri });
}
