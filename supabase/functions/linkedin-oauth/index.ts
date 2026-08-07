import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SCOPES = "openid profile email";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const clientId = Deno.env.get("LINKEDIN_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET") ?? "";
    const configuredRedirect = Deno.env.get("LINKEDIN_REDIRECT_URI") ?? "";
    const configured = Boolean(clientId && clientSecret);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, code: "NOT_AUTHENTICATED", message: "Please sign in and try again.", requestId }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return json({ ok: false, code: "NOT_AUTHENTICATED", message: "Please sign in and try again.", requestId }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile) {
      return json({ ok: false, code: "PROFILE_NOT_FOUND", message: "Profile not found.", requestId }, 400);
    }

    let payload: { action?: string; code?: string; redirectUri?: string } = {};
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, code: "BAD_REQUEST", message: "Invalid request body.", requestId }, 400);
    }

    const action = payload.action ?? "status";
    const redirectUri = (payload.redirectUri || configuredRedirect || "").trim();

    if (action === "status") {
      const { data: account } = await admin
        .from("linkedin_accounts")
        .select("member_name, headline, profile_url, connected_at, scopes")
        .eq("profile_id", profile.id)
        .maybeSingle();
      return json({ ok: true, configured, connected: Boolean(account), account: account ?? null, requestId });
    }

    if (!configured) {
      return json({
        ok: false,
        code: "LINKEDIN_NOT_CONFIGURED",
        message:
          "LinkedIn is not configured for this deployment. Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI to your deployment secrets. Manual LinkedIn search still works.",
        requestId,
      }, 400);
    }

    if (action === "authorize") {
      if (!redirectUri) {
        return json({ ok: false, code: "MISSING_REDIRECT_URI", message: "No redirect URI configured.", requestId }, 400);
      }
      const state = crypto.randomUUID();
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("state", state);
      return json({ ok: true, authorizationUrl: url.toString(), state, requestId });
    }

    if (action === "exchange") {
      if (!payload.code) {
        return json({ ok: false, code: "MISSING_CODE", message: "Missing authorization code.", requestId }, 400);
      }
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: payload.code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokenText = await tokenRes.text();
      if (!tokenRes.ok) {
        console.error(`[${requestId}] LinkedIn token exchange failed ${tokenRes.status}`);
        const code = tokenRes.status === 429 ? "RATE_LIMITED" : "LINKEDIN_API_ERROR";
        return json({ ok: false, code, message: `LinkedIn rejected the authorization (${tokenRes.status}).`, requestId }, 502);
      }
      const token = JSON.parse(tokenText) as { access_token: string; expires_in?: number; scope?: string };

      const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!meRes.ok) {
        const code = meRes.status === 403 ? "PERMISSION_DENIED" : meRes.status === 429 ? "RATE_LIMITED" : "LINKEDIN_API_ERROR";
        return json({ ok: false, code, message: `Could not read your LinkedIn profile (${meRes.status}).`, requestId }, 502);
      }
      const me = await meRes.json() as { name?: string; email?: string; sub?: string; picture?: string };

      const { error } = await admin.from("linkedin_accounts").upsert({
        profile_id: profile.id,
        member_name: me.name ?? "",
        headline: "",
        profile_url: "https://www.linkedin.com/in/me",
        access_token: token.access_token,
        expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
        scopes: token.scope ?? SCOPES,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" });
      if (error) {
        return json({ ok: false, code: "STORAGE_ERROR", message: error.message, requestId }, 500);
      }
      return json({ ok: true, connected: true, memberName: me.name ?? "", requestId });
    }

    if (action === "disconnect") {
      const { error } = await admin.from("linkedin_accounts").delete().eq("profile_id", profile.id);
      if (error) return json({ ok: false, code: "STORAGE_ERROR", message: error.message, requestId }, 500);
      await admin.from("networking_targets").delete().eq("profile_id", profile.id).eq("source", "linkedin");
      return json({ ok: true, connected: false, requestId });
    }

    return json({ ok: false, code: "UNKNOWN_ACTION", message: `Unknown action: ${action}`, requestId }, 400);
  } catch (e) {
    console.error(`[${requestId}] linkedin-oauth error`, e);
    return json({ ok: false, code: "UNEXPECTED_ERROR", message: (e as Error).message, requestId }, 500);
  }
});
