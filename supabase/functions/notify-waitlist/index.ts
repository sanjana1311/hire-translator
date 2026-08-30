import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { full_name, email, linkedin_url, reason } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // Deployment-specific: who receives access requests, and the verified sender.
    const NOTIFY_EMAIL = Deno.env.get("WAITLIST_NOTIFY_EMAIL");
    const FROM_EMAIL = Deno.env.get("WAITLIST_FROM_EMAIL") ?? "hireOS <onboarding@resend.dev>";

    if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
      console.log("RESEND_API_KEY or WAITLIST_NOTIFY_EMAIL not set — skipping email notification");
      console.log("New waitlist request:", { full_name, email, linkedin_url, reason });
      return new Response(JSON.stringify({ success: true, email_sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const esc = (value: unknown) =>
      String(value ?? "")
        .slice(0, 500)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const emailBody = `
      <h2>New hireOS access request</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;">
        <tr><td style="padding:6px 12px;font-weight:bold;">Name</td><td style="padding:6px 12px;">${esc(full_name)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;">${esc(email)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">LinkedIn</td><td style="padding:6px 12px;">${esc(linkedin_url) || "—"}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">Reason</td><td style="padding:6px 12px;">${esc(reason) || "—"}</td></tr>
      </table>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        subject: `New access request: ${esc(full_name)}`,
        html: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
    }

    return new Response(JSON.stringify({ success: true, email_sent: res.ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
