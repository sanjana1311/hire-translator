import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify auth & get provider token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use anon client with user's JWT to get session
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    // Get the provider token (Google access token) from session
    const jwt = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, supabaseKey);
    
    // We need to get the provider_token from the user's session
    // The client sends it in the request body
    const { providerToken } = await req.json();
    if (!providerToken) {
      throw new Error("No Google provider token. Please sign in with Google first.");
    }

    // Search Gmail for job alert emails
    const query = encodeURIComponent(
      'subject:(job alert OR new job OR job opportunity OR "jobs for you" OR "new jobs") newer_than:7d'
    );
    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error("Gmail API error:", gmailRes.status, errText);
      if (gmailRes.status === 401 || gmailRes.status === 403) {
        throw new Error("Gmail access denied. Please sign in again with Google.");
      }
      throw new Error(`Gmail API error: ${gmailRes.status}`);
    }

    const gmailData = await gmailRes.json();
    const messageIds = (gmailData.messages || []).map((m: any) => m.id);

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ jobs: [], message: "No job alert emails found in the last 7 days." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch email details (batch up to 10)
    const emailBodies: string[] = [];
    for (const msgId of messageIds.slice(0, 10)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      // Extract subject
      const subject = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
      const from = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === "from")?.value || "";

      // Extract body text
      let body = "";
      if (msg.payload?.body?.data) {
        body = atob(msg.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      } else if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find((p: any) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          body = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        }
      }

      emailBodies.push(`FROM: ${from}\nSUBJECT: ${subject}\n\n${body.slice(0, 3000)}`);
    }

    if (emailBodies.length === 0) {
      return new Response(JSON.stringify({ jobs: [], message: "Could not read email contents." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract job listings
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.2,
        max_tokens: 2000,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_jobs",
              description: "Extract job listings from email content",
              parameters: {
                type: "object",
                properties: {
                  jobs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Job title" },
                        company: { type: "string", description: "Company name" },
                        location: { type: "string", description: "Job location or Remote" },
                        url: { type: "string", description: "Application URL if found, empty string otherwise" },
                        source: { type: "string", description: "Email source (LinkedIn, Indeed, etc.)" },
                        snippet: { type: "string", description: "Brief description if available" },
                      },
                      required: ["title", "company", "location", "url", "source", "snippet"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["jobs"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_jobs" } },
        messages: [
          {
            role: "system",
            content:
              "Extract individual job listings from these job alert emails. Return unique jobs only. If a job title or company is unclear, skip it.",
          },
          {
            role: "user",
            content: `Extract jobs from these ${emailBodies.length} emails:\n\n${emailBodies.join("\n\n---EMAIL SEPARATOR---\n\n")}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
      if (status === 402) throw new Error("AI credits exhausted.");
      throw new Error("AI extraction failed");
    }

    const aiData = await aiRes.json();
    let jobs: any[] = [];
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        jobs = parsed.jobs || [];
      } catch {
        console.error("Failed to parse AI tool call response");
      }
    }

    // Deduplicate by title+company
    const seen = new Set<string>();
    jobs = jobs.filter((j: any) => {
      const key = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return new Response(JSON.stringify({ jobs, emailCount: emailBodies.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("fetch-gmail-jobs error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
