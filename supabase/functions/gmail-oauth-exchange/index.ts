import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    // Verify the user
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { code, redirectUri } = await req.json();
    if (!code) throw new Error("Missing authorization code");

    // Exchange the auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, err);
      throw new Error(`Google token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json();
    console.log("[Gmail OAuth] Token exchange successful, refresh_token:", tokens.refresh_token ? "present" : "missing");

    // Store refresh token
    if (tokens.refresh_token) {
      await adminClient
        .from("gmail_sync_metadata")
        .upsert(
          {
            profile_id: profile.id,
            refresh_token: tokens.refresh_token,
            enabled: true,
          },
          { onConflict: "profile_id" }
        );
      console.log("[Gmail OAuth] Refresh token stored for profile:", profile.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Gmail OAuth] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
