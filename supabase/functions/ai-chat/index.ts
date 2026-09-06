import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const response = await callAI({ messages, temperature, maxTokens: maxOutputTokens });
    const text = response.choices?.[0]?.message?.content || "";
    if (!text) return json({ error: "AI provider returned an empty response. Please try again." }, 502);

    await adminClient.from("ai_usage").insert({ user_id: user.id, feature: feat });

    return json({ text });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return json({ error: err?.message || "Unexpected error" }, 500);
  }
});
