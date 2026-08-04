import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 10;

// Set when OpenCode Go rejects us (bad key / no credits) so later calls skip it.
let opencodeDisabled = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Diagnostic probe: checks provider reachability only. No user data, no secrets returned.
    const diagToken = Deno.env.get("AI_DIAG_TOKEN");
    if (diagToken && req.headers.get("x-diag-token") === diagToken) {
      const results: Record<string, unknown> = {};

      const oc = Deno.env.get("OPENCODE_API_KEY");
      const ocBase = Deno.env.get("OPENCODE_BASE_URL") || "https://opencode.ai/zen/v1";
      const ocModel = Deno.env.get("OPENCODE_MODEL") || "grok-4.5";
      results.opencode = { configured: !!oc, baseUrl: ocBase, model: ocModel };
      if (oc) {
        try {
          const r = await fetch(`${ocBase}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${oc}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: ocModel, max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
          });
          const body = await r.text();
          results.opencode = { ...(results.opencode as object), status: r.status, body: body.slice(0, 300) };
        } catch (e) {
          results.opencode = { ...(results.opencode as object), error: String(e).slice(0, 200) };
        }
      }

      const lk = Deno.env.get("LOVABLE_API_KEY");
      results.lovable = { configured: !!lk };
      if (lk) {
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Lovable-API-Key": lk, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "google/gemini-3.6-flash", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
          });
          const body = await r.text();
          results.lovable = { configured: true, status: r.status, body: body.slice(0, 300) };
        } catch (e) {
          results.lovable = { configured: true, error: String(e).slice(0, 200) };
        }
      }

      const gq = Deno.env.get("GROQ_API_KEY");
      results.groq = { configured: !!gq };
      if (gq) {
        try {
          const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${gq}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 5, messages: [{ role: "user", content: "ping" }] }),
          });
          const body = await r.text();
          results.groq = { configured: true, status: r.status, body: body.slice(0, 300) };
        } catch (e) {
          results.groq = { configured: true, error: String(e).slice(0, 200) };
        }
      }

      return json({ diagnostic: true, providers: results });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { prompt, maxTokens, feature } = await req.json();
    if (!prompt) return json({ error: "prompt required" }, 400);
    const feat = feature || "general";

    // Rate limit: 10 AI calls per day per user per feature
    const adminClient = createClient(supabaseUrl, serviceKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count, error: countErr } = await adminClient
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("feature", feat)
      .gte("used_at", today.toISOString());
    if (countErr) console.error("Usage count error:", countErr);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: `Daily AI limit reached for ${feat} (${DAILY_LIMIT}/day). Try again tomorrow.` }, 429);
    }

    const temperature = feat === "roles" ? 0.7 : 0.3;
    const messages = [{ role: "user", content: prompt }];
    let text = "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const OPENCODE_API_KEY = Deno.env.get("OPENCODE_API_KEY");
    const OPENCODE_BASE_URL = Deno.env.get("OPENCODE_BASE_URL") || "https://opencode.ai/zen/v1";
    const OPENCODE_MODEL = Deno.env.get("OPENCODE_MODEL") || "grok-4.5";

    // Primary provider: OpenCode Go (OpenAI-compatible).
    // Skipped for the rest of this instance's life once it returns 401/402/403
    // (bad key or no balance) so we don't pay the latency on every call.
    if (OPENCODE_API_KEY && !opencodeDisabled) {
      try {
        const res = await fetch(`${OPENCODE_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENCODE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: OPENCODE_MODEL,
            temperature,
            max_tokens: maxTokens || 1000,
            messages,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          text = data.choices?.[0]?.message?.content || "";
        } else {
          const body = await res.text();
          console.error("OpenCode Go error:", res.status, body);
          if ([401, 402, 403].includes(res.status)) {
            opencodeDisabled = true;
            console.error("OpenCode Go disabled for this instance (auth/credits). Using fallbacks.");
          }
        }
      } catch (e) {
        console.error("OpenCode Go request failed:", e);
      }
    }


    // Fallback 1: Lovable AI
    if (!text && LOVABLE_API_KEY) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          temperature,
          max_tokens: maxTokens || 1000,
          messages,
        }),
      });

      if (res.status === 429) console.error("Lovable AI rate limited");
      else if (res.status === 402) console.error("Lovable AI credits exhausted");
      else if (res.ok) {
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || "";
      } else {
        console.error("AI gateway error:", res.status, await res.text());
      }
    }

    // Fallback 2: Groq
    if (!text && GROQ_API_KEY) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens || 1000,
          messages,
        }),
      });
      if (!res.ok) {
        console.error("Groq API error:", res.status, await res.text());
      } else {
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || "";
      }
    }

    if (!text) return json({ error: "AI provider unavailable. Please try again." }, 502);

    await adminClient.from("ai_usage").insert({ user_id: user.id, feature: feat });

    return json({ text });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return json({ error: err?.message || "Unexpected error" }, 500);
  }
});
