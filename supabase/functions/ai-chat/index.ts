import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 10;
const HF_MODEL = "Qwen/Qwen3-8B";
const OPENCODE_GO_MODEL = "kimi-k3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callHuggingFace(
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
) {
  const token = Deno.env.get("HF_TOKEN");
  if (!token) return "";

  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: HF_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    console.error("Hugging Face API error:", res.status, await res.text());
    return "";
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenCodeGo(
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
) {
  const token = Deno.env.get("OPENCODE_GO_API_KEY");
  if (!token) return "";

  const res = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENCODE_GO_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    console.error("OpenCode Go API error:", res.status, await res.text());
    return "";
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const maxOutputTokens = maxTokens || 1000;
    let text = "";

    // Primary provider: OpenCode Go subscription.
    text = await callOpenCodeGo(messages, temperature, maxOutputTokens);

    // Optional free-tier fallback: open-weight Qwen through Hugging Face.
    if (!text) text = await callHuggingFace(messages, temperature, maxOutputTokens);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (LOVABLE_API_KEY) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          temperature,
          max_tokens: maxOutputTokens,
          messages,
        }),
      });

      if (res.status === 429) return json({ error: "AI rate limit reached. Please retry shortly." }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted. Add credits in Settings → Plans & credits." }, 402);

      if (res.ok) {
        const data = await res.json();
        text = data.choices?.[0]?.message?.content || "";
      } else {
        console.error("AI gateway error:", res.status, await res.text());
      }
    }

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
          max_tokens: maxOutputTokens,
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
