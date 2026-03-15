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
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not set — skipping email notification");
      console.log("New waitlist request:", { full_name, email, linkedin_url, reason });
      return new Response(JSON.stringify({ success: true, email_sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailBody = `
      <h2>🚀 New Career Compass Access Request</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;">
        <tr><td style="padding:6px 12px;font-weight:bold;">Name</td><td style="padding:6px 12px;">${full_name}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">Email</td><td style="padding:6px 12px;">${email}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">LinkedIn</td><td style="padding:6px 12px;">${linkedin_url || "—"}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;">Reason</td><td style="padding:6px 12px;">${reason || "—"}</td></tr>
      </table>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Career Compass <onboarding@resend.dev>",
        to: ["hrsanjana26@gmail.com"],
        subject: `🚀 New access request: ${full_name}`,
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
